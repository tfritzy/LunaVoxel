using System;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void
    ReplacePalette(ReducerContext ctx, string projectId, int[] colors)
    {
        if (colors.Length == 0)
        {
            throw new Exception("Cannot replace palette with empty color array");
        }

        foreach (var color in colors)
        {
            if (!IsValidHexColor(color))
            {
                throw new Exception($"Invalid color format: {color}. Use #RRGGBB format.");
            }
        }

        var palette = ctx.Db.color_palette.ProjectId.Find(projectId);
        if (palette == null)
        {
            palette = new ColorPalette { ProjectId = projectId, Colors = colors };
            ctx.Db.color_palette.Insert(palette);
        }
        else
        {
            palette.Colors = colors;
            ctx.Db.color_palette.ProjectId.Update(palette);
        }
    }
}
