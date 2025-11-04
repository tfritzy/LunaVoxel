using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void DeleteSelection(ReducerContext ctx, string projectId)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var selection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (selection == null)
        {
            return;
        }

        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} with layer {selection.Layer}");

        if (layer.Locked)
        {
            Log.Info($"Layer {layer.Id} is locked - cannot delete selection");
            throw new InvalidOperationException("Cannot delete selection on a locked layer");
        }

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);
        var layerVoxels = VoxelCompression.Decompress(layer.Voxels);

        if (selectionData.Length != layerVoxels.Length)
        {
            Log.Error($"Selection data length ({selectionData.Length}) doesn't match layer voxels length ({layerVoxels.Length})");
            // Delete the selection to recover from this error state
            ctx.Db.selections.Id.Delete(selection.Id);
            return;
        }

        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                layerVoxels[i] = 0; // Set to empty/air block
            }
        }

        layer.Voxels = VoxelCompression.Compress(layerVoxels);
        ctx.Db.layer.Id.Update(layer);

        // Delete the selection after applying it
        ctx.Db.selections.Id.Delete(selection.Id);
    }
}
