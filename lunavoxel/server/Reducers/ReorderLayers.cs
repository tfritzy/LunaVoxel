using SpacetimeDB;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void ReorderLayers(ReducerContext ctx, string projectId, string[] newOrder)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layers = ctx.Db.layer.layer_project.Filter(projectId).ToList();

        if (layers.Count == 0) return;

        var layerDict = layers.ToDictionary(l => l.Id, l => l);

        for (int i = 0; i < newOrder.Length; i++)
        {
            string layerId = newOrder[i];

            if (layerDict.TryGetValue(layerId, out var layer))
            {
                if (layer.Index != i)
                {
                    layer.Index = i;
                    ctx.Db.layer.Id.Update(layer);
                }
            }
        }

        var unorderedLayers = layers
            .Where(l => !newOrder.Contains(l.Id))
            .OrderBy(l => l.Index)
            .ToList();

        int nextIndex = newOrder.Length;
        foreach (var layer in unorderedLayers)
        {
            if (layer.Index != nextIndex)
            {
                layer.Index = nextIndex;
                ctx.Db.layer.Id.Update(layer);
            }
            nextIndex++;
        }
    }
}