using SpacetimeDB;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void ToggleLayerVisibility(ReducerContext ctx, string layerId)
    {
        var layer = ctx.Db.layer.Id.Find(layerId)
            ?? throw new ArgumentException("Layer not found");

        EnsureAccessToProject.Check(ctx, layer.ProjectId, ctx.Sender);

        layer.Visible = !layer.Visible;
        ctx.Db.layer.Id.Update(layer);
    }
}