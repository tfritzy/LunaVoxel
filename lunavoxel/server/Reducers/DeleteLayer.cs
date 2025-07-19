using SpacetimeDB;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void DeleteLayer(ReducerContext ctx, string id)
    {
        var layer = ctx.Db.layer.Id.Find(id)
            ?? throw new ArgumentException("Layer not found");

        EnsureAccessToProject.Check(ctx, layer.ProjectId, ctx.Sender);

        ctx.Db.layer.Delete(layer);
    }
}