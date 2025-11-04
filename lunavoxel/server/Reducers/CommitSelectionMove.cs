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

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);
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

        selection.SelectionData = VoxelCompression.Compress(tempData);
        ctx.Db.selections.Id.Update(selection);
    }
}
