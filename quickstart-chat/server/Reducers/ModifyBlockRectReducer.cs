using System;
using System.Collections.Generic;
using SpacetimeDB;
public static partial class Module
{
    [Reducer]
    public static void ModifyBlockRect(
        ReducerContext ctx,
        string world,
        BlockModificationMode mode,
        MeshType type,
        int x1,
        int y1,
        int z1,
        int x2,
        int y2,
        int z2,
        bool isPreview = false)
    {
        var chunk = ctx.Db.Chunk.Id.Find($"{world}_0") ?? throw new ArgumentException("No chunk for this world");
        List<Vector3> positions = [];
        int startX = Math.Max(0, Math.Min(Math.Min(x1, x2), chunk.xDim - 1));
        int endX = Math.Min(chunk.xDim - 1, Math.Max(Math.Max(x1, x2), 0));
        int startY = Math.Max(0, Math.Min(Math.Min(y1, y2), chunk.yDim - 1));
        int endY = Math.Min(chunk.yDim - 1, Math.Max(Math.Max(y1, y2), 0));
        int startZ = Math.Max(0, Math.Min(Math.Min(z1, z2), chunk.zDim - 1));
        int endZ = Math.Min(chunk.zDim - 1, Math.Max(Math.Max(z1, z2), 0));
        for (int x = startX; x <= endX; x++)
        {
            for (int y = startY; y <= endY; y++)
            {
                for (int z = startZ; z <= endZ; z++)
                {
                    positions.Add(new Vector3(x, y, z));
                }
            }
        }
        ModifyBlock(ctx, world, mode, type, positions, isPreview);
    }
}