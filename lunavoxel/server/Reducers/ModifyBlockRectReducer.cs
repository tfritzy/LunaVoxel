using System;
using System.Collections.Generic;
using SpacetimeDB;
public static partial class Module
{
    [Reducer]
    public static void ModifyBlockRect(
        ReducerContext ctx,
        string projectId,
        BlockModificationMode mode,
        int type,
        int x1,
        int y1,
        int z1,
        int x2,
        int y2,
        int z2,
        int rotation,
        int layerIndex)
    {
        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
             ?? throw new ArgumentException("No layer for this project");
        List<Vector3> positions = [];
        int startX = Math.Max(0, Math.Min(Math.Min(x1, x2), layer.xDim - 1));
        int endX = Math.Min(layer.xDim - 1, Math.Max(Math.Max(x1, x2), 0));
        int startY = Math.Max(0, Math.Min(Math.Min(y1, y2), layer.yDim - 1));
        int endY = Math.Min(layer.yDim - 1, Math.Max(Math.Max(y1, y2), 0));
        int startZ = Math.Max(0, Math.Min(Math.Min(z1, z2), layer.zDim - 1));
        int endZ = Math.Min(layer.zDim - 1, Math.Max(Math.Max(z1, z2), 0));
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

        ModifyBlock(ctx, projectId, mode, type, positions, rotation, layerIndex);
    }
}