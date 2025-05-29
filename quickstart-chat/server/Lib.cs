using System.Globalization;
using System.Reflection.Metadata.Ecma335;
using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "World", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "idx_owner_last_visited", Columns = new[] { nameof(Owner), nameof(LastVisited) })]
    public partial class World
    {
        [PrimaryKey]
        public string Id;
        public string Name;
        public int XWidth;
        public int YWidth;
        public int Height;
        public Identity Owner;
        public Timestamp LastVisited;

        public static World Build(string name, int xWidth, int yWidth, int height, Identity owner, Timestamp timestamp)
        {
            return new World
            {
                Id = IdGenerator.Generate("wrld"),
                Name = name,
                XWidth = xWidth,
                YWidth = yWidth,
                Height = height,
                Owner = owner,
                LastVisited = timestamp
            };
        }
    }

    [Table(Name = "PlayerInWorld", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "player_world", Columns = new[] { nameof(Player), nameof(World) })]
    public partial class PlayerInWorld
    {
        [PrimaryKey]
        public string Id;
        public Identity Player;
        public string World;
        public int SelectedColorIndex = 0;
    }

    [Table(Name = "PreviewVoxels", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "player_world", Columns = new[] { nameof(Player), nameof(World) })]
    public partial class PreviewVoxels
    {
        [PrimaryKey]
        public string Id;
        public Identity Player;
        public string World;
        public Vector3[] PreviewPositions = [];
        public string BlockColor;
        public bool IsAddMode;
    }

    [Table(Name = "ColorPalette", Public = true)]
    public partial class ColorPalette
    {
        [PrimaryKey]
        public string World;
        public string[] Colors;
    }

    [Type]
    public partial struct Block
    {
        public BlockType Type;
        public int Count;
        public string Color;

        public Block(BlockType type, int count, string color = "#FFFFFF")
        {
            this.Type = type;
            this.Count = count;
            this.Color = color;
        }
    }

    [Type]
    public partial struct Vector3(int x, int y, int z)
    {
        public int X = x;
        public int Y = y;
        public int Z = z;
    }

    [Type]
    public enum BlockType { Empty, Block, RoundBlock }

    [Table(Name = "Chunk", Public = true)]
    public partial class Chunk
    {
        [PrimaryKey]
        public string Id;
        public string World;
        public int X;
        public int Y;
        public Block[] Blocks = [];

        public static Chunk Build(string world, int x, int y, int z)
        {
            return new Chunk
            {
                Id = $"{world}_{x}_{y}",
                X = x,
                Y = y,
                World = world,
                Blocks = [new Block(BlockType.Empty, z)]
            };
        }
    }

    [Reducer]
    public static void BuildBlock(ReducerContext ctx, string world, BlockType type, int x1, int y1, int z1, int x2, int y2, int z2, bool isPreview = false)
    {
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, world)).FirstOrDefault()
            ?? throw new ArgumentException("You're not in this world.");

        var palette = ctx.Db.ColorPalette.World.Find(world)
            ?? throw new ArgumentException("No color palette for world.");
        var color = palette.Colors[player.SelectedColorIndex];

        int minX = Math.Min(x1, x2);
        int maxX = Math.Max(x1, x2);
        int minY = Math.Min(y1, y2);
        int maxY = Math.Max(y1, y2);
        int minZ = Math.Min(z1, z2);
        int maxZ = Math.Max(z1, z2);

        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();

        if (isPreview)
        {
            if (previewVoxels == null)
            {
                previewVoxels = new PreviewVoxels
                {
                    Id = IdGenerator.Generate("prvw"),
                    Player = ctx.Sender,
                    World = world,
                    PreviewPositions = [],
                    IsAddMode = true,
                    BlockColor = color
                };
                ctx.Db.PreviewVoxels.Insert(previewVoxels);
            }

            var positions = new List<Vector3>();
            for (int x = minX; x <= maxX; x++)
            {
                for (int y = minY; y <= maxY; y++)
                {
                    for (int z = minZ; z <= maxZ; z++)
                    {
                        positions.Add(new Vector3(x, y, z));
                    }
                }
            }

            previewVoxels.PreviewPositions = positions.ToArray();
            previewVoxels.BlockColor = color;
            previewVoxels.IsAddMode = true;
            ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
            return;
        }

        var existingPreview = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();
        if (existingPreview != null)
        {
            existingPreview.PreviewPositions = [];
            ctx.Db.PreviewVoxels.Id.Update(existingPreview);
        }

        var affectedChunkIds = new HashSet<string>();
        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                affectedChunkIds.Add($"{world}_{x}_{y}");
            }
        }

        var chunks = new Dictionary<string, Chunk>();
        foreach (var chunkId in affectedChunkIds)
        {
            var chunk = ctx.Db.Chunk.Id.Find(chunkId);
            if (chunk != null)
            {
                chunks[chunkId] = chunk;
            }
        }

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                var chunkId = $"{world}_{x}_{y}";
                if (chunks.ContainsKey(chunkId))
                {
                    var chunk = chunks[chunkId];
                    for (int z = minZ; z <= maxZ; z++)
                    {
                        BlockCompression.SetBlock(ref chunk.Blocks, type, z, color);
                    }
                }
            }
        }

        foreach (var chunk in chunks.Values)
        {
            ctx.Db.Chunk.Id.Update(chunk);
        }
    }

    [Reducer]
    public static void EraseBlock(ReducerContext ctx, string world, int x1, int y1, int z1, int x2, int y2, int z2, bool isPreview = false)
    {
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, world)).FirstOrDefault()
            ?? throw new ArgumentException("You're not in this world.");

        int minX = Math.Min(x1, x2);
        int maxX = Math.Max(x1, x2);
        int minY = Math.Min(y1, y2);
        int maxY = Math.Max(y1, y2);
        int minZ = Math.Min(z1, z2);
        int maxZ = Math.Max(z1, z2);

        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();

        if (isPreview)
        {
            if (previewVoxels == null)
            {
                previewVoxels = new PreviewVoxels
                {
                    Id = IdGenerator.Generate("prvw"),
                    Player = ctx.Sender,
                    World = world,
                    PreviewPositions = [],
                    IsAddMode = false,
                    BlockColor = "#FF0000"
                };
                ctx.Db.PreviewVoxels.Insert(previewVoxels);
            }

            var positions = new List<Vector3>();
            for (int x = minX; x <= maxX; x++)
            {
                for (int y = minY; y <= maxY; y++)
                {
                    for (int z = minZ; z <= maxZ; z++)
                    {
                        positions.Add(new Vector3(x, y, z));
                    }
                }
            }

            previewVoxels.PreviewPositions = positions.ToArray();
            previewVoxels.IsAddMode = false;
            ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
            return;
        }

        var existingPreview = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();
        if (existingPreview != null)
        {
            existingPreview.PreviewPositions = [];
            ctx.Db.PreviewVoxels.Id.Update(existingPreview);
        }

        var affectedChunkIds = new HashSet<string>();
        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                affectedChunkIds.Add($"{world}_{x}_{y}");
            }
        }

        var chunks = new Dictionary<string, Chunk>();
        foreach (var chunkId in affectedChunkIds)
        {
            var chunk = ctx.Db.Chunk.Id.Find(chunkId);
            if (chunk != null)
            {
                chunks[chunkId] = chunk;
            }
        }

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                var chunkId = $"{world}_{x}_{y}";
                if (chunks.ContainsKey(chunkId))
                {
                    var chunk = chunks[chunkId];
                    for (int z = minZ; z <= maxZ; z++)
                    {
                        BlockCompression.SetBlock(ref chunk.Blocks, BlockType.Empty, z);
                    }
                }
            }
        }

        foreach (var chunk in chunks.Values)
        {
            ctx.Db.Chunk.Id.Update(chunk);
        }
    }

    [Reducer]
    public static void PaintBlock(ReducerContext ctx, string world, int x1, int y1, int z1, int x2, int y2, int z2, bool isPreview = false)
    {
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, world)).FirstOrDefault()
            ?? throw new ArgumentException("You're not in this world.");

        var palette = ctx.Db.ColorPalette.World.Find(world)
            ?? throw new ArgumentException("No color palette for world.");
        var color = palette.Colors[player.SelectedColorIndex];

        int minX = Math.Min(x1, x2);
        int maxX = Math.Max(x1, x2);
        int minY = Math.Min(y1, y2);
        int maxY = Math.Max(y1, y2);
        int minZ = Math.Min(z1, z2);
        int maxZ = Math.Max(z1, z2);

        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();

        // Get all affected chunks (shared for both preview and actual operation)
        var affectedChunkIds = new HashSet<string>();
        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                affectedChunkIds.Add($"{world}_{x}_{y}");
            }
        }

        var chunks = new Dictionary<string, Chunk>();
        foreach (var chunkId in affectedChunkIds)
        {
            var chunk = ctx.Db.Chunk.Id.Find(chunkId);
            if (chunk != null)
            {
                chunks[chunkId] = chunk;
            }
        }

        if (isPreview)
        {
            if (previewVoxels == null)
            {
                previewVoxels = new PreviewVoxels
                {
                    Id = IdGenerator.Generate("prvw"),
                    Player = ctx.Sender,
                    World = world,
                    PreviewPositions = [],
                    IsAddMode = true,
                    BlockColor = color
                };
                ctx.Db.PreviewVoxels.Insert(previewVoxels);
            }

            var positions = new List<Vector3>();

            // Only add positions that have existing non-empty blocks
            for (int x = minX; x <= maxX; x++)
            {
                for (int y = minY; y <= maxY; y++)
                {
                    var chunkId = $"{world}_{x}_{y}";
                    if (chunks.ContainsKey(chunkId))
                    {
                        var chunk = chunks[chunkId];
                        for (int z = minZ; z <= maxZ; z++)
                        {
                            var existingBlock = BlockCompression.GetBlock(chunk.Blocks, z);
                            if (existingBlock.Type != BlockType.Empty)
                            {
                                positions.Add(new Vector3(x, y, z));
                            }
                        }
                    }
                }
            }

            previewVoxels.PreviewPositions = positions.ToArray();
            previewVoxels.BlockColor = color;
            previewVoxels.IsAddMode = true;
            ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
            return;
        }

        // Clear preview when doing actual paint
        var existingPreview = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();
        if (existingPreview != null)
        {
            existingPreview.PreviewPositions = [];
            ctx.Db.PreviewVoxels.Id.Update(existingPreview);
        }
        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                affectedChunkIds.Add($"{world}_{x}_{y}");
            }
        }

        foreach (var chunkId in affectedChunkIds)
        {
            var chunk = ctx.Db.Chunk.Id.Find(chunkId);
            if (chunk != null)
            {
                chunks[chunkId] = chunk;
            }
        }

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                var chunkId = $"{world}_{x}_{y}";
                if (chunks.ContainsKey(chunkId))
                {
                    var chunk = chunks[chunkId];
                    for (int z = minZ; z <= maxZ; z++)
                    {
                        var existingBlock = BlockCompression.GetBlock(chunk.Blocks, z);
                        if (existingBlock.Type != BlockType.Empty)
                        {
                            BlockCompression.SetBlock(ref chunk.Blocks, existingBlock.Type, z, color);
                        }
                    }
                }
            }
        }

        foreach (var chunk in chunks.Values)
        {
            ctx.Db.Chunk.Id.Update(chunk);
        }
    }

    [Reducer]
    public static void CreateWorld(ReducerContext ctx, string name, int xDim, int yDim, int zDim)
    {
        var world = World.Build(name, xDim, yDim, zDim, ctx.Sender, ctx.Timestamp);
        ctx.Db.World.Insert(world);

        for (int x = -xDim / 2; x < xDim / 2; x++)
        {
            for (int y = -yDim / 2; y < yDim / 2; y++)
            {
                ctx.Db.Chunk.Insert(Chunk.Build(world.Id, x, y, zDim));
            }
        }

        InitializePalette(ctx, world.Id);
    }

    [Reducer]
    public static void VisitWorld(ReducerContext ctx, string worldId)
    {
        var world = ctx.Db.World.Id.Find(worldId) ?? throw new Exception($"World with ID {worldId} not found");

        world.LastVisited = ctx.Timestamp;
        ctx.Db.World.Id.Update(world);

        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault();
        if (player == null)
        {
            ctx.Db.PlayerInWorld.Insert(new PlayerInWorld
            {
                Id = IdGenerator.Generate("plr_wrld"),
                Player = ctx.Sender,
                World = worldId,
                SelectedColorIndex = 0
            });
        }

        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault();
        if (previewVoxels == null)
        {
            ctx.Db.PreviewVoxels.Insert(new PreviewVoxels
            {
                Id = IdGenerator.Generate("prvw"),
                Player = ctx.Sender,
                World = worldId,
                BlockColor = "#FFFFFF",
                IsAddMode = false,
                PreviewPositions = []
            });
        }

        Log.Info($"User {ctx.Sender} visited world {worldId} at {ctx.Timestamp}");
    }

    [Reducer]
    public static void InitializePalette(ReducerContext ctx, string worldId)
    {
        var existingPalette = ctx.Db.ColorPalette.World.Find(worldId);
        if (existingPalette != null)
        {
            return;
        }

        var defaultColors = new string[]
        {
            "#2e2e43",
            "#4a4b5b",
            "#707b89",
            "#a9bcbf",
            "#e6eeed",
            "#fcfbf3",
            "#fceba8",
            "#f5c47c",
            "#e39764",
            "#c06852",
            "#9d4343",
            "#813645",
            "#542240",
            "#2a152d",
            "#4f2d4d",
            "#5b3a56",
            "#794e6d",
            "#3e4c7e",
            "#495f94",
            "#5a78b2",
            "#7396d5",
            "#7fbbdc",
            "#aaeeea",
            "#d5f893",
            "#96dc7f",
            "#6ec077",
            "#4e9363",
            "#3c6c54",
            "#2c5049",
            "#34404f",
            "#405967",
            "#5c8995",
        };

        ctx.Db.ColorPalette.Insert(new ColorPalette
        {
            World = worldId,
            Colors = defaultColors
        });

        Log.Info($"Initialized color palette for world {worldId}");
    }

    [Reducer]
    public static void AddColorToPalette(ReducerContext ctx, string worldId, string colorHex)
    {
        var world = ctx.Db.World.Id.Find(worldId)
            ?? throw new Exception($"World with ID {worldId} not found");

        if (!IsValidHexColor(colorHex))
        {
            throw new Exception("Invalid color format. Use #RRGGBB format.");
        }

        var palette = ctx.Db.ColorPalette.World.Find(worldId);
        if (palette == null)
        {
            InitializePalette(ctx, worldId);
            palette = ctx.Db.ColorPalette.World.Find(worldId)!;
        }

        if (palette.Colors.Contains(colorHex))
        {
            return;
        }

        var newColors = palette.Colors.ToList();
        newColors.Add(colorHex);
        palette.Colors = newColors.ToArray();

        ctx.Db.ColorPalette.World.Update(palette);
    }

    [Reducer]
    public static void RemoveColorFromPalette(ReducerContext ctx, string worldId, string colorHex)
    {
        var world = ctx.Db.World.Id.Find(worldId)
            ?? throw new Exception($"World with ID {worldId} not found");

        var palette = ctx.Db.ColorPalette.World.Find(worldId);
        if (palette == null || !palette.Colors.Contains(colorHex))
        {
            return;
        }

        var newColors = palette.Colors.Where(c => c != colorHex).ToArray();

        palette.Colors = newColors;
        ctx.Db.ColorPalette.World.Update(palette);
    }

    [Reducer]
    public static void SelectColorIndex(ReducerContext ctx, string worldId, int colorIndex)
    {
        var playerId = $"{ctx.Sender}_{worldId}";
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault()
            ?? throw new Exception($"Player is not in world {worldId}");

        var palette = ctx.Db.ColorPalette.World.Find(worldId)
            ?? throw new Exception($"Palette not found for world {worldId}");

        if (colorIndex < 0 || colorIndex >= palette.Colors.Length)
        {
            throw new Exception($"Color index {colorIndex} is out of range");
        }

        player.SelectedColorIndex = colorIndex;
        ctx.Db.PlayerInWorld.Id.Update(player);
    }

    private static bool IsValidHexColor(string color)
    {
        if (string.IsNullOrWhiteSpace(color) || color.Length != 7 || !color.StartsWith("#"))
        {
            return false;
        }

        return color.Substring(1).All(c =>
            (c >= '0' && c <= '9') ||
            (c >= 'a' && c <= 'f') ||
            (c >= 'A' && c <= 'F'));
    }
}