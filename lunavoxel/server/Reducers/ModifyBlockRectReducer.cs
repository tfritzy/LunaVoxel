using System;
using System.Collections.Generic;
using SpacetimeDB;

public static partial class Module
{
    static int Clamp(int value, int max) =>
        Math.Max(0, Math.Min(value, max - 1));


    [Reducer]
    public static void ModifyBlockRect(
        ReducerContext ctx,
        string projectId,
        ToolType mode,
        uint type,
        Vector3 start,
        Vector3 end,
        uint rotation,
        int layerIndex)
    {
        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        uint[] diffData = new uint[layer.xDim * layer.yDim * layer.zDim];
        var existingData = VoxelCompression.Decompress(layer.Voxels);

        int sx = Clamp(start.X, layer.xDim);
        int sy = Clamp(start.Y, layer.yDim);
        int sz = Clamp(start.Z, layer.zDim);

        int ex = Clamp(end.X, layer.xDim);
        int ey = Clamp(end.Y, layer.yDim);
        int ez = Clamp(end.Z, layer.zDim);

        int minX = Math.Min(sx, ex);
        int maxX = Math.Max(sx, ex);
        int minY = Math.Min(sy, ey);
        int maxY = Math.Max(sy, ey);
        int minZ = Math.Min(sz, ez);
        int maxZ = Math.Max(sz, ez);

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                for (int z = minZ; z <= maxZ; z++)
                {
                    int index = x * layer.yDim * layer.zDim + y * layer.zDim + z;
                    var cur = BlockType.FromInt(existingData[index]);
                    uint? newValue = mode switch
                    {
                        ToolType.Build =>
                            VoxelDataUtils.EncodeBlockData(type, rotation, cur.Version + 1),
                        ToolType.Erase =>
                            VoxelDataUtils.EncodeBlockData(0, 0, cur.Version + 1),
                        ToolType.Paint when cur.Type != 0 =>
                            VoxelDataUtils.EncodeBlockData(type, cur.Rotation, cur.Version + 1),
                        _ => 0
                    };

                    if (newValue.HasValue)
                    {
                        diffData[index] = newValue.Value;
                    }
                }
            }
        }

        ModifyBlock(ctx, projectId, diffData, layerIndex);
    }
}