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
        BlockModificationMode mode,
        byte type,
        Vector3 start,
        Vector3 end,
        byte rotation,
        int layerIndex)
    {
        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

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

        var chunkUpdates = new Dictionary<string, List<(Vector3 pos, byte value)>>();

        for (int x = minX; x <= maxX; x++)
        {
            for (int y = minY; y <= maxY; y++)
            {
                for (int z = minZ; z <= maxZ; z++)
                {
                    var position = new Vector3(x, y, z);
                    
                    byte valueToSet;
                    if (mode == BlockModificationMode.Erase)
                    {
                        valueToSet = 0;
                    }
                    else if (mode == BlockModificationMode.Paint)
                    {
                        byte currentValue = GetVoxelFromChunks(ctx, layer.Id, position);
                        if (currentValue == 0)
                        {
                            continue; // Skip empty voxels in paint mode
                        }
                        valueToSet = type;
                    }
                    else
                    {
                        valueToSet = type;
                    }


                    // Calculate chunk identifier
                    var chunkMinPos = CalculateChunkMinPosition(position);
                    var chunkKey = GetChunkKey(chunkMinPos);

                    if (!chunkUpdates.ContainsKey(chunkKey))
                    {
                        chunkUpdates[chunkKey] = new List<(Vector3, byte)>();
                    }

                    chunkUpdates[chunkKey].Add((position, valueToSet));
                }
            }
        }

        // Apply updates to each affected chunk
        foreach (var kvp in chunkUpdates)
        {
            var firstPos = kvp.Value[0].pos;
            var chunk = GetOrCreateChunk(ctx, layer.Id, firstPos, layer);
            var voxels = VoxelCompression.Decompress(chunk.Voxels);

            foreach (var (pos, value) in kvp.Value)
            {
                // Calculate local position within chunk
                var localPos = new Vector3(
                    pos.X - chunk.MinPosX,
                    pos.Y - chunk.MinPosY,
                    pos.Z - chunk.MinPosZ
                );
                var index = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
                voxels[index] = value;
            }

            chunk.Voxels = VoxelCompression.Compress(voxels);
            ctx.Db.chunk.Id.Update(chunk);

            // Delete chunk if it becomes empty after erase
            if (mode == BlockModificationMode.Erase)
            {
                DeleteChunkIfEmpty(ctx, chunk);
            }
        }
    }
}