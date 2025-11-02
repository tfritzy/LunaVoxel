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
                int z = i % zDim;
                int y = (i / zDim) % yDim;
                int x = i / (yDim * zDim);

                int newX = (x + offset.X) % xDim;
                int newY = (y + offset.Y) % yDim;
                int newZ = (z + offset.Z) % zDim;

                if (newX < 0) newX += xDim;
                if (newY < 0) newY += yDim;
                if (newZ < 0) newZ += zDim;

                int newIndex = newX * yDim * zDim + newY * zDim + newZ;
                newSelectionData[newIndex] = (byte)(newIndex + 1);
            }
        }

        return newSelectionData;
    }
}
