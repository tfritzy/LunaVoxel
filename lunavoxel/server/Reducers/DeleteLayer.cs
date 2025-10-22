using SpacetimeDB;
using SpacetimeDB.Internal.TableHandles;
using System.Linq;
using System.Runtime.CompilerServices;
public static partial class Module
{
    [Reducer]
    public static void DeleteLayer(ReducerContext ctx, string id)
    {
        var layer = ctx.Db.layer.Id.Find(id)
            ?? throw new ArgumentException("Layer not found");
        EnsureAccessToProject.Check(ctx, layer.ProjectId, ctx.Sender);
        var layers = ctx.Db.layer.layer_project.Filter(layer.ProjectId)
            .ToList();
        layers.Sort((l1, l2) => l1.Index - l2.Index);
        ctx.Db.layer.Id.Delete(id);

        var chunks = ctx.Db.chunk.ProjectId_LayerId.Filter((layer.ProjectId, layer.Id))
            .ToList();
        foreach (var chunk in chunks)
        {
            ctx.Db.chunk.Delete(chunk);
        }

        var remainingLayers = layers.Where(l => l.Id != id).ToList();
        for (int i = 0; i < remainingLayers.Count; i++)
        {
            var layerToUpdate = remainingLayers[i];
            if (layerToUpdate.Index != i)
            {
                layerToUpdate.Index = i;
                ctx.Db.layer.Id.Update(layerToUpdate);
            }
        }
    }
}