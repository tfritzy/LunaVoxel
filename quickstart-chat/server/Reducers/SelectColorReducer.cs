using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void
    SelectColor(ReducerContext ctx, string worldId, string color)
    {
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault()
            ?? throw new Exception($"Player is not in world {worldId}");

        player.SelectedColor = color;
        ctx.Db.PlayerInWorld.Id.Update(player);
    }
}
