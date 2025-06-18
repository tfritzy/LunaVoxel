using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void
    AddColorToPalette(ReducerContext ctx, string projectId, int color)
    {
        if (!IsValidHexColor(color))
        {
            throw new Exception("Invalid color format. Use #RRGGBB format.");
        }

        var palette = ctx.Db.color_palette.ProjectId.Find(projectId);
        if (palette == null)
        {
            InitializePalette(ctx, projectId);
            palette = ctx.Db.color_palette.ProjectId.Find(projectId)!;
        }

        if (palette.Colors.Contains(color))
        {
            return;
        }

        var newColors = palette.Colors.ToList();
        newColors.Add(color);
        palette.Colors = newColors.ToArray();

        ctx.Db.color_palette.ProjectId.Update(palette);
    }
}
