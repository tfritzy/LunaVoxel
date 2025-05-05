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
    public enum BlockType { Empty, Block, LongBlock }

    [Table(Name = "Chunk", Public = true)]
    public partial class Chunk
    {
        [PrimaryKey]
        public string Id;
        public string World;
        public int X;
        public int Y;
        public BlockType[] Blocks = [];

        public static Chunk Build(string world, int x, int y, int z)
        {
            return new Chunk
            {
                Id = $"{world}_{x}_{y}",
                X = x,
                Y = y,
                World = world,
                Blocks = new BlockType[z]
            };
        }
    }

    [Reducer]
    public static void PlaceBlock(ReducerContext ctx, string world, BlockType type, int x, int y, int z)
    {
        var chunk = ctx.Db.Chunk.Id.Find($"{world}_{x}_{y}");

        if (chunk == null)
            throw new ArgumentException("Could not find specified chunk");

        chunk.Blocks[z] = type;
        ctx.Db.Chunk.Id.Update(chunk);
    }

    [Reducer]
    public static void CreateWorld(ReducerContext ctx, string name, int xDim, int yDim, int zDim)
    {
        var world = World.Build(name, xDim, yDim, zDim);
        ctx.Db.World.Insert(world);

        for (int x = 0; x < xDim; x++)
        {
            for (int y = 0; y < yDim; y++)
            {
                ctx.Db.Chunk.Insert(Chunk.Build(world.Id, x, y, zDim));
            }
        }
    }
}