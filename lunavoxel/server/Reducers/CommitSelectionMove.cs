using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void CommitSelectionMove(ReducerContext ctx, string projectId)
    {
        var selection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (selection == null)
        {
            return;
        }

        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {selection.Layer}");

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);
        var layerVoxels = VoxelCompression.Decompress(layer.Voxels);

        // Create a new voxel array to store the result
        var newLayerVoxels = new byte[layerVoxels.Length];
        Array.Copy(layerVoxels, newLayerVoxels, layerVoxels.Length);

        // Create a new selection data array with offsets reset
        var newSelectionData = new byte[selectionData.Length];

        // First pass: Clear all source positions in the layer that are selected
        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                newLayerVoxels[i] = 0; // Clear the original position
            }
        }

        // Second pass: Place blocks at their new positions
        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                int targetPosition = selectionData[i] - 1; // Convert from 1-indexed to 0-indexed
                if (targetPosition >= 0 && targetPosition < layerVoxels.Length)
                {
                    // Move the block to the new position
                    newLayerVoxels[targetPosition] = layerVoxels[i];
                    // Set the new selection data to indicate the block is now at its target position (no offset)
                    newSelectionData[targetPosition] = (byte)(targetPosition + 1);
                }
            }
        }

        // Update the layer with the new voxel data
        layer.Voxels = VoxelCompression.Compress(newLayerVoxels);
        ctx.Db.layer.Id.Update(layer);

        // Update the selection with the new positions (offsets reset)
        selection.SelectionData = VoxelCompression.Compress(newSelectionData);
        ctx.Db.selections.Id.Update(selection);
    }
}
