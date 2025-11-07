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

        ctx.Db.selections.Id.Update(selection);
    }
}
