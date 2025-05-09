using System.Globalization;
using System.Reflection.Metadata.Ecma335;
using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "World", Public = true)]
    public partial class World
    {
        [PrimaryKey]
        public string Id;
        public string Name;
        public int XWidth;
        public int YWidth;
        public int Height;

        public static World Build(string name, int xWidth, int yWidth, int height)
        {
            return new World
            {
                Id = IdGenerator.Generate("wrld"),
                Name = name,
                XWidth = xWidth,
                YWidth = yWidth,
                Height = height
            };
        }
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
    public enum BlockType { Empty, Block, LongBlock }

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
        var world = World.Build(name, xDim, yDim, zDim);
        ctx.Db.World.Insert(world);

        for (int x = -xDim / 2; x < xDim / 2; x++)
        {
            for (int y = -yDim / 2; y < yDim / 2; y++)
            {
                ctx.Db.Chunk.Insert(Chunk.Build(world.Id, x, y, zDim));
            }
        }
    }
}