using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void
    SelectColorIndex(ReducerContext ctx, string worldId, int colorIndex)
    {
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault()
            ?? throw new Exception($"Player is not in world {worldId}");
        var palette =
            ctx.Db.ColorPalette.World.Find(worldId) ?? throw new Exception($"Palette not found for world {worldId}");

        if (colorIndex < 0 || colorIndex >= palette.Colors.Length)
        {
            throw new Exception($"Color index {colorIndex} is out of range");
        }

        player.SelectedColor = COLOR_ID_PREFIX + colorIndex;
        ctx.Db.PlayerInWorld.Id.Update(player);
    }
}
