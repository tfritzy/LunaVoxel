using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void DeleteSelection(ReducerContext ctx, string projectId)
    {
        Log.Info($"DeleteSelection started - Project: {projectId}");

        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var selection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (selection == null)
        {
            Log.Info("No selection found for user");
            return;
        }

        Log.Info($"Found selection {selection.Id} - Layer: {selection.Layer}");

        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {selection.Layer}");

        if (layer.Locked)
        {
            Log.Info($"Layer {layer.Id} is locked - cannot delete selection");
            throw new InvalidOperationException("Cannot delete selection on a locked layer");
        }

        Log.Info($"Layer found - Dimensions: {layer.xDim}x{layer.yDim}x{layer.zDim}");

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);
        var layerVoxels = VoxelCompression.Decompress(layer.Voxels);

        if (selectionData.Length != layerVoxels.Length)
        {
            Log.Error($"Selection data length ({selectionData.Length}) doesn't match layer voxels length ({layerVoxels.Length})");
            throw new ArgumentException("Selection data size mismatch with layer");
        }

        int deletedCount = 0;
        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                layerVoxels[i] = 0; // Set to empty/air block
                deletedCount++;
            }
        }

        Log.Info($"Deleted {deletedCount} voxels from layer");

        layer.Voxels = VoxelCompression.Compress(layerVoxels);
        ctx.Db.layer.Id.Update(layer);

        // Delete the selection after applying it
        ctx.Db.selections.Id.Delete(selection.Id);
        Log.Info($"Deleted selection {selection.Id}");

        Log.Info($"DeleteSelection completed successfully - {deletedCount} voxels deleted");
    }
}
