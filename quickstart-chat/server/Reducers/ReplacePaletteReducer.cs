using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void
    ReplacePalette(ReducerContext ctx, string worldId, string[] colors)
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

        var palette = ctx.Db.ColorPalette.World.Find(worldId);
        if (palette == null)
        {
            palette = new ColorPalette { World = worldId, Colors = colors };
            ctx.Db.ColorPalette.Insert(palette);
        }
        else
        {
            palette.Colors = colors;
            ctx.Db.ColorPalette.World.Update(palette);
        }

        // The following filter was in the original code and might be logically flawed
        // as it filters by `ctx.Sender.ToString()` in `SelectedColor`.
        // A more common approach would be to iterate all players in the world.
        var playersInWorld = ctx.Db.PlayerInWorld.world_color.Filter((worldId, ctx.Sender.ToString())).ToList();

        foreach (var player in playersInWorld)
        {
            if (player.SelectedColor.StartsWith(COLOR_ID_PREFIX))
            {
                int currentIndex = int.Parse(player.SelectedColor.Split(COLOR_ID_PREFIX)[1]);
                if (currentIndex >= colors.Length)
                {
                    player.SelectedColor = COLOR_ID_PREFIX + "0";
                    ctx.Db.PlayerInWorld.Id.Update(player);
                }
            }
        }
    }
}
