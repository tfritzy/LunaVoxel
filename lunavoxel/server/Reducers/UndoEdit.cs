using System;
using System.Collections.Generic;
using SpacetimeDB;
using System.Linq;
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
        var beforeData = VoxelCompression.Decompress(beforeDiff);
        var afterData = VoxelCompression.Decompress(afterDiff);

        // Group positions by chunks to check current state
        var chunkUpdates = new Dictionary<string, List<(Vector3 pos, byte beforeValue, byte afterValue)>>();

        for (int i = 0; i < beforeData.Length; i++)
        {
            if (beforeData[i] != 0 || afterData[i] != 0)
            {
                // Calculate 3D position from flat index
                int x = i / (layer.yDim * layer.zDim);
                int y = (i % (layer.yDim * layer.zDim)) / layer.zDim;
                int z = i % layer.zDim;
                var position = new Vector3(x, y, z);

                // Calculate chunk identifier
                var chunkMinPos = new Vector3(
                    (x / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
                    (y / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
                    (z / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE
                );
                var chunkKey = $"{chunkMinPos.X},{chunkMinPos.Y},{chunkMinPos.Z}";

                if (!chunkUpdates.ContainsKey(chunkKey))
                {
                    chunkUpdates[chunkKey] = new List<(Vector3, byte, byte)>();
                }

                chunkUpdates[chunkKey].Add((position, beforeData[i], afterData[i]));
            }
        }

        // Apply updates only to voxels that are still in the modified state
        var revertData = new byte[beforeData.Length];
        foreach (var kvp in chunkUpdates)
        {
            foreach (var (pos, beforeValue, afterValue) in kvp.Value)
            {
                var currentValue = GetVoxelFromChunks(ctx, layer.Id, pos);
                
                // Only revert voxels that are still in the "after" state
                if (currentValue == afterValue)
                {
                    int flatIndex = pos.X * layer.yDim * layer.zDim + pos.Y * layer.zDim + pos.Z;
                    revertData[flatIndex] = beforeValue;
                }
            }
        }

        ModifyBlock(ctx, projectId, BlockModificationMode.Attach, revertData, layerIndex);
    }
}