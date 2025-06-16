using System;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateWorldName(ReducerContext ctx, string worldId, string name)
    {
        if (string.IsNullOrWhiteSpace(worldId))
            throw new ArgumentException("World ID cannot be null or empty");

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("World name cannot be null or empty");

        name = name.Trim();

        if (name.Length > 100)
            throw new ArgumentException("World name cannot exceed 100 characters");

        if (name.Length < 1)
            throw new ArgumentException("World name must be at least 1 character long");

        var world = ctx.Db.World.Id.Find(worldId)
            ?? throw new Exception($"World with ID {worldId} not found");

        if (world.Owner != ctx.Sender)
            throw new UnauthorizedAccessException("Only the world owner can update the world name");

        world.Name = name;
        ctx.Db.World.Id.Update(world);
    }
}