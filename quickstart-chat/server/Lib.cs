using System.Globalization;
using System.Reflection.Metadata.Ecma335;
using SpacetimeDB;

public static partial class Module
{
    public const string COLOR_ID_PREFIX = "idx";

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

        public static World Build(string id, string name, int xWidth, int yWidth, int height, Identity owner, Timestamp timestamp)
        {
            return new World
            {
                Id = id,
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
        public string SelectedColor;
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
        public string? BlockColor;
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
    public partial struct BlockRun
    {
        public BlockType Type;
        public int Count;
        public string? Color;

        public BlockRun(BlockType type, int count, string? color = null)
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

    [Type]
    public enum BlockModificationMode { Build, Erase, Paint }

    [Table(Name = "Chunk", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "chunk_world", Columns = new[] { nameof(World) })]
    public partial class Chunk
    {
        [PrimaryKey]
        public string Id;
        public string World;
        public int xDim;
        public int yDim;
        public int zDim;
        public int Layer;
        public BlockRun[][][] Blocks = [];

        public static Chunk Build(string world, int xDim, int yDim, int zDim, int layer)
        {
            BlockRun[][][] blocks = new BlockRun[xDim][][];
            for (int i = 0; i < xDim; i++)
            {
                blocks[i] = new BlockRun[yDim][];
                for (int j = 0; j < yDim; j++)
                {
                    blocks[i][j] = [new BlockRun() { Count = zDim, Type = BlockType.Empty }];
                }
            }
            return new Chunk
            {
                Id = $"{world}_{layer}",
                World = world,
                xDim = xDim,
                yDim = yDim,
                zDim = zDim,
                Blocks = blocks,
                Layer = layer
            };
        }
    }

    [Reducer]
    public static void ModifyBlock(ReducerContext ctx, string world, BlockModificationMode mode, BlockType type, int x1, int y1, int z1, int x2, int y2, int z2, bool isPreview = false)
    {
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, world)).FirstOrDefault()
            ?? throw new ArgumentException("You're not in this world.");
        var palette = ctx.Db.ColorPalette.World.Find(world)
            ?? throw new ArgumentException("No color palette for world.");
        var color = GetPlayerColor(player.SelectedColor, palette);
        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();
        var chunk = ctx.Db.Chunk.Id.Find($"{world}_0")
            ?? throw new ArgumentException("No chunk for this world");

        int minX = Math.Min(x1, x2);
        int maxX = Math.Max(x1, x2);
        int minY = Math.Min(y1, y2);
        int maxY = Math.Max(y1, y2);
        int minZ = Math.Min(z1, z2);
        int maxZ = Math.Max(z1, z2);

        minX = Math.Max(0, Math.Min(minX, chunk.xDim - 1));
        maxX = Math.Max(0, Math.Min(maxX, chunk.xDim - 1));
        minY = Math.Max(0, Math.Min(minY, chunk.yDim - 1));
        maxY = Math.Max(0, Math.Min(maxY, chunk.yDim - 1));
        minZ = Math.Max(0, Math.Min(minZ, chunk.zDim - 1));
        maxZ = Math.Max(0, Math.Min(maxZ, chunk.zDim - 1));

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
                    IsAddMode = mode != BlockModificationMode.Erase,
                    BlockColor = mode == BlockModificationMode.Erase ? null : color
                };
                ctx.Db.PreviewVoxels.Insert(previewVoxels);
            }

            var positions = new List<Vector3>();
            if (mode == BlockModificationMode.Paint || mode == BlockModificationMode.Erase)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    for (int y = minY; y <= maxY; y++)
                    {
                        for (int z = minZ; z <= maxZ; z++)
                        {
                            var existingBlock = BlockCompression.GetBlock(chunk.Blocks[x][y], z);
                            if (existingBlock.Type != BlockType.Empty)
                            {
                                positions.Add(new Vector3(x, y, z));
                            }
                        }
                    }
                }
            }
            else
            {
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
            }

            previewVoxels.PreviewPositions = positions.ToArray();
            previewVoxels.BlockColor = mode == BlockModificationMode.Erase ? "#FFffff" : color;
            previewVoxels.IsAddMode = mode != BlockModificationMode.Erase;
            ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
            return;
        }

        if (previewVoxels != null)
        {
            previewVoxels.PreviewPositions = [];
            ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
        }

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                for (int z = minZ; z <= maxZ; z++)
                {
                    switch (mode)
                    {
                        case BlockModificationMode.Build:
                            BlockCompression.SetBlock(ref chunk.Blocks[x][y], type, z, color);
                            break;
                        case BlockModificationMode.Erase:
                            BlockCompression.SetBlock(ref chunk.Blocks[x][y], BlockType.Empty, z);
                            break;
                        case BlockModificationMode.Paint:
                            var existingBlock = BlockCompression.GetBlock(chunk.Blocks[x][y], z);
                            if (existingBlock.Type != BlockType.Empty)
                            {
                                BlockCompression.SetBlock(ref chunk.Blocks[x][y], existingBlock.Type, z, color);
                            }
                            break;
                    }
                }
            }
        }

        ctx.Db.Chunk.Id.Update(chunk);
    }

    [Reducer]
    public static void CreateWorld(ReducerContext ctx, string id, string name, int xDim, int yDim, int zDim)
    {
        var world = World.Build(id, name, xDim, yDim, zDim, ctx.Sender, ctx.Timestamp);
        ctx.Db.World.Insert(world);
        ctx.Db.Chunk.Insert(Chunk.Build(world.Id, xDim, yDim, zDim, 0));
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
                SelectedColor = COLOR_ID_PREFIX + "0"
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

        player.SelectedColor = COLOR_ID_PREFIX + colorIndex;
        ctx.Db.PlayerInWorld.Id.Update(player);
    }

    [Reducer]
    public static void SelectColor(ReducerContext ctx, string worldId, string color)
    {
        var playerId = $"{ctx.Sender}_{worldId}";
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault()
            ?? throw new Exception($"Player is not in world {worldId}");

        player.SelectedColor = color;
        ctx.Db.PlayerInWorld.Id.Update(player);
    }

    public static string GetPlayerColor(string selectedColor, ColorPalette palette)
    {
        if (selectedColor.StartsWith(COLOR_ID_PREFIX))
        {
            int index = int.Parse(selectedColor.Split(COLOR_ID_PREFIX)[1]);
            return palette.Colors[index % palette.Colors.Length];
        }
        else
        {
            return selectedColor;
        }
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