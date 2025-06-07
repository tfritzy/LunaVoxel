using SpacetimeDB;
using System.Collections.Generic;
using System;

public static partial class Module
{
    [Reducer]
    public static void ModifyBlockRect(ReducerContext ctx, string world, BlockModificationMode mode, MeshType type, int x1, int y1, int z1,
                    int x2, int y2, int z2, bool isPreview = false)
    {
        Log.Info($"ModifyBlockRect: {world}, {mode}, {type}, ({x1}, {y1}, {z1}) to ({x2}, {y2}, {z2}), isPreview: {isPreview}");
        List<Vector3> positions = [];

        int startX = Math.Min(x1, x2);
        int endX = Math.Max(x1, x2);
        int startY = Math.Min(y1, y2);
        int endY = Math.Max(y1, y2);
        int startZ = Math.Min(z1, z2);
        int endZ = Math.Max(z1, z2);

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
