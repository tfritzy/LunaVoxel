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

        // Get the layer to know dimensions
        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault();
        if (layer == null)
        {
            return;
        }

        // Convert frames to global array for processing
        var selectionData = SelectionHelper.ConvertFramesToGlobalArray(
            selection.SelectionFrames, 
            layer.xDim, 
            layer.yDim, 
            layer.zDim
        );
        
        var tempData = new byte[selectionData.Length];

        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                int targetPosition = selectionData[i] - 1;
                if (targetPosition >= 0 && targetPosition < selectionData.Length)
                {
                    tempData[targetPosition] = (byte)(targetPosition + 1);
                }
            }
        }

        // Convert back to chunk-based frames
        selection.SelectionFrames = SelectionHelper.ConvertGlobalArrayToFrames(
            tempData, 
            layer.xDim, 
            layer.yDim, 
            layer.zDim
        );
        ctx.Db.selections.Id.Update(selection);
    }
}
