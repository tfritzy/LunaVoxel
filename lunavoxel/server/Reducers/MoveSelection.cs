using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void MoveSelection(ReducerContext ctx, string projectId, Vector3 offset)
    {
        var selection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (selection == null)
        {
            return;
        }

        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {selection.Layer}");

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);
        var newSelectionData = TranslateSelectionData(selectionData, offset, layer.xDim, layer.yDim, layer.zDim);
        var compressedSelection = VoxelCompression.Compress(newSelectionData);

        selection.SelectionData = compressedSelection;
        ctx.Db.selections.Id.Update(selection);
    }

    public static byte[] TranslateSelectionData(byte[] selectionData, Vector3 offset, int xDim, int yDim, int zDim)
    {
        var newSelectionData = new byte[selectionData.Length];

        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                // The value at index i represents the current position (1-indexed)
                // Convert to 0-indexed position
                int currentValue = selectionData[i] - 1;
                
                // Calculate current position from the value
                int z = currentValue % zDim;
                int y = (currentValue / zDim) % yDim;
                int x = currentValue / (yDim * zDim);

                // Apply the offset with wrapping
                int newX = (x + offset.X) % xDim;
                int newY = (y + offset.Y) % yDim;
                int newZ = (z + offset.Z) % zDim;

                if (newX < 0) newX += xDim;
                if (newY < 0) newY += yDim;
                if (newZ < 0) newZ += zDim;

                // Calculate the new position value
                int newPosition = newX * yDim * zDim + newY * zDim + newZ;
                // Store the new position (1-indexed) at the same index
                newSelectionData[i] = (byte)(newPosition + 1);
            }
        }

        return newSelectionData;
    }
}
