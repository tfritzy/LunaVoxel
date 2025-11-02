using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void MoveSelection(ReducerContext ctx, string projectId, Vector3 offset)
    {
        Log.Info($"MoveSelection started - Project: {projectId}, Offset: ({offset.X}, {offset.Y}, {offset.Z})");

        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var selection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (selection == null)
        {
            Log.Info("No selection found for user");
            return;
        }

        Log.Info($"Found selection - ID: {selection.Id}");

        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {selection.Layer}");

        Log.Info($"Layer found - Dimensions: {layer.xDim}x{layer.yDim}x{layer.zDim}");

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);
        Log.Info($"Decompressed {selectionData.Length} bytes from selection");

        var newSelectionData = new byte[selectionData.Length];
        int movedCount = 0;

        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                // This voxel is selected at position i
                // The value stored represents the original position (1-indexed)
                // Calculate the current position from the index
                int z = i % layer.zDim;
                int y = (i / layer.zDim) % layer.yDim;
                int x = i / (layer.yDim * layer.zDim);

                // Apply the offset
                int newX = x + offset.X;
                int newY = y + offset.Y;
                int newZ = z + offset.Z;

                // Check if the new position is within bounds
                if (newX >= 0 && newX < layer.xDim &&
                    newY >= 0 && newY < layer.yDim &&
                    newZ >= 0 && newZ < layer.zDim)
                {
                    // Calculate the new index
                    int newIndex = newX * layer.yDim * layer.zDim + newY * layer.zDim + newZ;
                    // Preserve the original selection value (which tracks the original position)
                    newSelectionData[newIndex] = selectionData[i];
                    movedCount++;
                }
                else
                {
                    Log.Debug($"Voxel at ({x}, {y}, {z}) would move out of bounds to ({newX}, {newY}, {newZ})");
                }
            }
        }

        Log.Info($"Moved {movedCount} voxels");

        var compressedSelection = VoxelCompression.Compress(newSelectionData);
        Log.Info($"Compressed selection - Original size: {newSelectionData.Length} bytes, Compressed: {compressedSelection.Length} bytes");

        selection.SelectionData = compressedSelection;
        ctx.Db.selections.Id.Update(selection);
        Log.Info($"Updated selection {selection.Id}");

        Log.Info($"MoveSelection completed successfully - {movedCount} voxels moved");
    }
}
