using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "world", Public = true)]
    public partial class World
    {
        [PrimaryKey]
        public int Id;
        public string? Name;
        public int Width;
        public int Height;
    }

    [Type]
    public enum BlockType { Empty, Block, LongBlock }

    public struct BlockRun
    {
        public BlockType BlockType;
        public int RunLength;
    }

    [Table(Name = "chunk", Public = true)]
    public partial class Chunk
    {
        [PrimaryKey]
        public string Id; // World_X_Z

        public BlockRun[] Blocks = [];
    }

    [Reducer]
    public static void PlaceBlock(ReducerContext ctx, int world, BlockType type, int x, int y, int z)
    {
        var chunk = ctx.Db.chunk.Id.Find($"{world}_{x}_{z}");


    }
}