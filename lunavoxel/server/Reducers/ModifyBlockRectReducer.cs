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
        uint type,
        Vector3 start,
        Vector3 end,
        uint rotation,
        int layerIndex)
    {
        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
             ?? throw new ArgumentException("No layer for this project");
        uint[] diffData = new uint[layer.xDim * layer.yDim * layer.zDim];
        var existingData = VoxelRLE.Decompress(layer.Voxels);

        int minX = Math.Max(Math.Min(start.X, end.X), 0);
        int maxX = Math.Min(Math.Max(start.X, end.X), layer.xDim - 1);
        int minY = Math.Max(Math.Min(start.Y, end.Y), 0);
        int maxY = Math.Min(Math.Max(start.Y, end.Y), layer.yDim - 1);
        int minZ = Math.Max(Math.Min(start.Z, end.Z), 0);
        int maxZ = Math.Min(Math.Max(start.Z, end.Z), layer.zDim - 1);

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
                        BlockModificationMode.Build =>
                            VoxelDataUtils.EncodeBlockData(type, rotation, cur.Version + 1),
                        BlockModificationMode.Erase =>
                            VoxelDataUtils.EncodeBlockData(0, 0, cur.Version + 1),
                        BlockModificationMode.Paint when cur.Type != 0 =>
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