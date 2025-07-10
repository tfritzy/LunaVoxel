using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void
    RemoveColorFromPalette(ReducerContext ctx, string projectId, int colorIndex)
    {
        var palette = ctx.Db.color_palette.ProjectId.Find(projectId);
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        if (palette == null)
        {
            return;
        }

        if (colorIndex < 0 || colorIndex >= palette.Colors.Length)
        {
            return;
        }

        var newColorsList = palette.Colors.ToList();
        newColorsList.RemoveAt(colorIndex);
        palette.Colors = newColorsList.ToArray();

        ctx.Db.color_palette.ProjectId.Update(palette);
    }
}
