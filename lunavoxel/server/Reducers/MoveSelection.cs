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
        
        var dimensions = new Vector3(
            selection.MaxPos.X - selection.MinPos.X,
            selection.MaxPos.Y - selection.MinPos.Y,
            selection.MaxPos.Z - selection.MinPos.Z
        );
        
        var newSelectionData = TranslateSelectionData(
            selectionData, 
            offset, 
            selection.MinPos, 
            dimensions,
            layer.xDim, 
            layer.yDim, 
            layer.zDim
        );
        
        var compressedSelection = VoxelCompression.Compress(newSelectionData);

        // Update the bounds
        selection.MinPos = new Vector3(
            selection.MinPos.X + offset.X,
            selection.MinPos.Y + offset.Y,
            selection.MinPos.Z + offset.Z
        );
        selection.MaxPos = new Vector3(
            selection.MaxPos.X + offset.X,
            selection.MaxPos.Y + offset.Y,
            selection.MaxPos.Z + offset.Z
        );
        selection.SelectionData = compressedSelection;
        ctx.Db.selections.Id.Update(selection);
    }

    public static byte[] TranslateSelectionData(
        byte[] selectionData, 
        Vector3 offset, 
        Vector3 minPos,
        Vector3 dimensions,
        int layerXDim, 
        int layerYDim, 
        int layerZDim)
    {
        var newSelectionData = new byte[selectionData.Length];

        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                // Get the target position from the selection data (1-indexed, convert to 0-indexed)
                int targetPosition = selectionData[i] - 1;
                
                // Convert target position index to 3D coordinates within layer
                int targetZ = targetPosition % layerZDim;
                int targetY = (targetPosition / layerZDim) % layerYDim;
                int targetX = targetPosition / (layerYDim * layerZDim);

                // Apply offset with wrapping
                int newTargetX = (targetX + offset.X) % layerXDim;
                int newTargetY = (targetY + offset.Y) % layerYDim;
                int newTargetZ = (targetZ + offset.Z) % layerZDim;

                if (newTargetX < 0) newTargetX += layerXDim;
                if (newTargetY < 0) newTargetY += layerYDim;
                if (newTargetZ < 0) newTargetZ += layerZDim;

                // Convert back to layer-space index
                int newTargetPosition = newTargetX * layerYDim * layerZDim + newTargetY * layerZDim + newTargetZ;
                newSelectionData[i] = (byte)(newTargetPosition + 1);
            }
        }

        return newSelectionData;
    }
}
