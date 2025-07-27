using System;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void Undo(ReducerContext ctx, string projectId)
    {
        if (string.IsNullOrWhiteSpace(projectId))
            throw new ArgumentException("Project ID cannot be null or empty");

        UndoRedo.Undo(ctx, projectId);
    }
}