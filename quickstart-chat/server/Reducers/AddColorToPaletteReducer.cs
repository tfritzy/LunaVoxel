using SpacetimeDB;
using System;
using System.Linq;
using System.Collections.Generic;

public static partial class Module
{
    [Reducer]
    public static void
    AddColorToPalette(ReducerContext ctx, string worldId, string colorHex)
    {
        var world = ctx.Db.World.Id.Find(worldId) ?? throw new Exception($"World with ID {worldId} not found");

        if (!IsValidHexColor(colorHex))
        {
            throw new Exception("Invalid color format. Use #RRGGBB format.");
        }

        var palette = ctx.Db.ColorPalette.World.Find(worldId);
        if (palette == null)
        {
            InitializePalette(ctx, worldId);
            palette = ctx.Db.ColorPalette.World.Find(worldId)!;
        }

        if (palette.Colors.Contains(colorHex))
        {
            return;
        }

        var newColors = palette.Colors.ToList();
        newColors.Add(colorHex);
        palette.Colors = newColors.ToArray();

        ctx.Db.ColorPalette.World.Update(palette);

        int newColorIndex = palette.Colors.Length - 1;

        // The following filter was in the original code and might be logically flawed
        // as it filters by `colorHex` in `SelectedColor` which is unlikely for indexed colors.
        var playersToUpdate = ctx.Db.PlayerInWorld.world_color.Filter((worldId, colorHex)).ToList();
        foreach (var player in playersToUpdate)
        {
            player.SelectedColor = COLOR_ID_PREFIX + newColorIndex;
            ctx.Db.PlayerInWorld.Id.Update(player);
        }
    }
}
