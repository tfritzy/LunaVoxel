using SpacetimeDB;
using static Module;

public static class LayerHelpers
{
    public static void Add(ReducerContext ctx, Layer layer)
    {
        var headEntry = ctx.Db.layer_history_entry.author_head.Filter((ctx.Sender, true)).FirstOrDefault();
        if (headEntry != null)
        {
            headEntry.IsHead = false;
            ctx.Db.layer_history_entry.Id.Update(headEntry);
        }

        ctx.Db.layer.Insert(layer);
        ctx.Db.layer_history_entry.Insert(LayerHistoryEntry.Build(
            layer.ProjectId,
            ctx.Sender,
            layer.Id,
            layer.Voxels,
            layer.Voxels,
            true
        ));
    }
}
