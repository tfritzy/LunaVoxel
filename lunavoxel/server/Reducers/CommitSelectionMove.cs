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

        // With the new structure, MinPos and MaxPos already represent the actual positions,
        // so there's nothing to commit - the positions are already updated by MoveSelection
        // We just need to ensure the selection exists and is valid
    }
}
