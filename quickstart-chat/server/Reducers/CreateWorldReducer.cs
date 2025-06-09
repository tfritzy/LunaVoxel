using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void
    CreateWorld(ReducerContext ctx, string id, string name, int xDim, int yDim, int zDim)
    {
        var world = World.Build(id, name, xDim, zDim, yDim, ctx.Sender, ctx.Timestamp);
        ctx.Db.World.Insert(world);
        ctx.Db.Chunk.Insert(Chunk.Build(world.Id, xDim, yDim, zDim, 0));
        InitializePalette(ctx, world.Id);
    }
}
