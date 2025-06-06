using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void
    VisitWorld(ReducerContext ctx, string worldId)
    {
        var world = ctx.Db.World.Id.Find(worldId) ?? throw new Exception($"World with ID {worldId} not found");

        world.LastVisited = ctx.Timestamp;
        ctx.Db.World.Id.Update(world);

        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault();
        if (player == null)
        {
            ctx.Db.PlayerInWorld.Insert(new PlayerInWorld
            {
                Id = IdGenerator.Generate("plr_wrld"),
                Player = ctx.Sender,
                World = worldId,
                SelectedColor = COLOR_ID_PREFIX + "0"
            });
        }

        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, worldId)).FirstOrDefault();
        if (previewVoxels == null)
        {
            ctx.Db.PreviewVoxels.Insert(new PreviewVoxels
            {
                Id = IdGenerator.Generate("prvw"),
                Player = ctx.Sender,
                World = worldId,
                BlockColor = "#FFFFFF",
                IsAddMode = false,
                PreviewPositions = Array.Empty<BlockRun>()
            });
        }
        Log.Info($"User {ctx.Sender} visited world {worldId} at {ctx.Timestamp}");
    }
}
