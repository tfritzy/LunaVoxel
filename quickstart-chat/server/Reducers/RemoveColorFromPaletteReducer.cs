using SpacetimeDB;
using System;
using System.Linq;
using System.Collections.Generic;

public static partial class Module
{
    [Reducer]
    public static void
    RemoveColorFromPalette(ReducerContext ctx, string worldId, int colorIndex)
    {
        var world = ctx.Db.World.Id.Find(worldId) ?? throw new Exception($"World with ID {worldId} not found");
        var palette = ctx.Db.ColorPalette.World.Find(worldId);
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

        ctx.Db.ColorPalette.World.Update(palette);
        int newColorsCount = palette.Colors.Length;

        // This logic is from the original code. It updates players using the removed
        // color index only if that index is now out of bounds.
        if (colorIndex < newColorsCount)
        {
            return;
        }

        var playersInWorld = ctx.Db.PlayerInWorld.world_color.Filter((worldId, COLOR_ID_PREFIX + colorIndex)).ToList();
        foreach (var player in playersInWorld)
        {
            player.SelectedColor = newColorsCount > 0 ? COLOR_ID_PREFIX + (newColorsCount - 1) : "#FFFFFF";
            ctx.Db.PlayerInWorld.Id.Update(player);
        }
    }
}
