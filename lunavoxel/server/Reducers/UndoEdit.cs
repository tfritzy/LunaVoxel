using System;
using System.Collections.Generic;
using SpacetimeDB;
public static partial class Module
{
    [Reducer]
    public static void UndoEdit(
        ReducerContext ctx,
        string projectId,
        byte[] beforeDiff,
        byte[] afterDiff,
        int layerIndex)
    {
        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
             ?? throw new ArgumentException("No layer for this project");
        var beforeData = VoxelRLE.Decompress(beforeDiff);
        var afterData = VoxelRLE.Decompress(afterDiff);
        var layerData = VoxelRLE.Decompress(layer.Voxels);

        for (int i = 0; i < beforeData.Length; i++)
        {
            // Only revert voxels that are in the modified state.
            // Voxel data includes version so that should handle 
            // multiple authors writing the same blocks.
            if (afterData[i] != layerData[i])
            {
                beforeData[i] = 0;
            }
        }

        ModifyBlock(ctx, projectId, beforeData, layerIndex);
    }
}