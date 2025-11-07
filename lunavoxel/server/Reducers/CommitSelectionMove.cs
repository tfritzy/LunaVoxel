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

        // With the new bounded structure, MinPos and MaxPos already represent the actual positions
        // and are updated immediately by MoveSelection. This reducer is kept for API compatibility
        // and to provide a clear signal that the move operation is complete.
        // Future enhancements could add validation or bounds checking here if needed.
        
        Log.Info($"Selection move committed for project {projectId}");
    }
}
