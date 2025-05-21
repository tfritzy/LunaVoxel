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

    [Table(Name = "PlayerInWorld")]
    [SpacetimeDB.Index.BTree(Name = "world", Columns = new[] { nameof(World) })]
    public partial class PlayerInWorld
    {
        [PrimaryKey]
        public string Id;
        public string World;
        public Vector3? PreviewPos;
        public int SelectedColorIndex = 0;
    }

    [Table(Name = "ColorPalette")]
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
        public bool Ghost;
        public string Color;

        public Block(BlockType type, int count, bool ghost, string color = "#FFFFFF")
        {
            this.Type = type;
            this.Count = count;
            this.Ghost = ghost;
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
                Blocks = [new Block(BlockType.Empty, z, false)]
            };
        }
    }
    [Reducer]
    public static void PlaceBlock(ReducerContext ctx, string world, BlockType type, int x, int y, int z, string color = "#FFFFFF", bool isPreview = false)
    {
        var chunk = ctx.Db.Chunk.Id.Find($"{world}_{x}_{y}") ?? throw new ArgumentException("Could not find specified chunk");
        if (isPreview)
        {
            var player = ctx.Db.PlayerInWorld.Id.Find($"{ctx.Sender}_{world}") ?? throw new ArgumentException("You're not in this world.");

            if (player.PreviewPos.HasValue)
            {
                var previewPos = player.PreviewPos.Value;
                var chunkId = $"{world}_{previewPos.X}_{previewPos.Y}";
                var previewChunk = chunkId != chunk.Id ? ctx.Db.Chunk.Id.Find(chunkId) : chunk;
                if (previewChunk != null && BlockCompression.GetBlock(previewChunk.Blocks, previewPos.Z).Ghost)
                {
                    BlockCompression.SetBlock(ref previewChunk.Blocks, BlockType.Empty, previewPos.Z, false, "#FFFFFF");

                    if (chunkId != chunk.Id)
                    {
                        ctx.Db.Chunk.Id.Update(previewChunk);
                    }
                }
            }

            var currBlock = BlockCompression.GetBlock(chunk.Blocks, z);
            if (currBlock.Type == BlockType.Empty || currBlock.Ghost)
            {
                player.PreviewPos = new Vector3(x, y, z);
                ctx.Db.PlayerInWorld.Id.Update(player);

                BlockCompression.SetBlock(ref chunk.Blocks, type, z, true, color);
                ctx.Db.Chunk.Id.Update(chunk);
            }
        }
        else
        {
            BlockCompression.SetBlock(ref chunk.Blocks, type, z, false, color);
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

        var player = ctx.Db.PlayerInWorld.Id.Find($"{ctx.Sender}_{worldId}");
        if (player == null)
        {
            ctx.Db.PlayerInWorld.Insert(new PlayerInWorld
            {
                Id = $"{ctx.Sender}_{worldId}",
                World = worldId,
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
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#FFFF00",
        "#FF00FF",
        "#00FFFF",
        "#FFFFFF",
        "#000000"
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
        var player = ctx.Db.PlayerInWorld.Id.Find(playerId)
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