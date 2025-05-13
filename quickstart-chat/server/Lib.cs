using System.Globalization;
using System.Reflection.Metadata.Ecma335;
using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "World", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "idx_owner", Columns = new[] { nameof(Owner) })]
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

    [Table(Name = "Player")]
    [SpacetimeDB.Index.BTree(Name = "idx_world", Columns = new[] { nameof(World), nameof(Id) })]
    public partial class PlayerInWorld
    {
        public string Id;
        public string World;
        public int CursorXPos;
        public int CursorYPos;
    }

    [Type]
    public partial struct Block
    {
        public BlockType Type;
        public int Count;
        public bool Ghost;

        public Block(BlockType type, int count, bool ghost)
        {
            this.Type = type;
            this.Count = count;
            this.Ghost = ghost;
        }
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
                Blocks = new Block[] { new Block(BlockType.Empty, z, false) }
            };
        }
    }

    [Reducer]
    public static void PlaceBlock(ReducerContext ctx, string world, BlockType type, int x, int y, int z)
    {
        var chunk = ctx.Db.Chunk.Id.Find($"{world}_{x}_{y}") ?? throw new ArgumentException("Could not find specified chunk");
        BlockCompression.SetBlock(ref chunk.Blocks, type, z, false);
        ctx.Db.Chunk.Id.Update(chunk);
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
    }

    [Reducer]
    public static void VisitWorld(ReducerContext ctx, string worldId)
    {
        var world = ctx.Db.World.Id.Find(worldId) ?? throw new Exception($"World with ID {worldId} not found");

        world.LastVisited = ctx.Timestamp;
        ctx.Db.World.Id.Update(world);

        Log.Info($"User {ctx.Sender} visited world {worldId} at {ctx.Timestamp}");
    }
}