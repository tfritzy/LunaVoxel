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

        int chunkMinX = (minX / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE;
        int chunkMaxX = (maxX / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE;
        int chunkMinY = (minY / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE;
        int chunkMaxY = (maxY / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE;
        int chunkMinZ = (minZ / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE;
        int chunkMaxZ = (maxZ / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE;

        for (int chunkX = chunkMinX; chunkX <= chunkMaxX; chunkX += MAX_CHUNK_SIZE)
        {
            for (int chunkY = chunkMinY; chunkY <= chunkMaxY; chunkY += MAX_CHUNK_SIZE)
            {
                for (int chunkZ = chunkMinZ; chunkZ <= chunkMaxZ; chunkZ += MAX_CHUNK_SIZE)
                {
                    var chunkPos = new Vector3(chunkX, chunkY, chunkZ);
                    var chunk = GetOrCreateChunk(ctx, layer.Id, chunkPos, layer);
                    var voxels = VoxelCompression.Decompress(chunk.Voxels);
                    bool chunkModified = false;

                    // Calculate bounds within this chunk
                    int localMinX = Math.Max(0, minX - chunkX);
                    int localMaxX = Math.Min(chunk.SizeX - 1, maxX - chunkX);
                    int localMinY = Math.Max(0, minY - chunkY);
                    int localMaxY = Math.Min(chunk.SizeY - 1, maxY - chunkY);
                    int localMinZ = Math.Max(0, minZ - chunkZ);
                    int localMaxZ = Math.Min(chunk.SizeZ - 1, maxZ - chunkZ);

                    for (int x = localMinX; x <= localMaxX; x++)
                    {
                        for (int y = localMinY; y <= localMaxY; y++)
                        {
                            for (int z = localMinZ; z <= localMaxZ; z++)
                            {
                                var index = CalculateVoxelIndex(new Vector3(x, y, z), chunk.SizeY, chunk.SizeZ);
                                
                                byte valueToSet;
                                if (mode == BlockModificationMode.Erase)
                                {
                                    valueToSet = 0;
                                }
                                else if (mode == BlockModificationMode.Paint)
                                {
                                    if (voxels[index] == 0)
                                    {
                                        continue; // Skip empty voxels in paint mode
                                    }
                                    valueToSet = type;
                                }
                                else // Attach mode
                                {
                                    valueToSet = type;
                                }

                                voxels[index] = valueToSet;
                                chunkModified = true;
                            }
                        }
                    }

                    if (chunkModified)
                    {
                        chunk.Voxels = VoxelCompression.Compress(voxels);
                        ctx.Db.chunk.Id.Update(chunk);

                        if (mode == BlockModificationMode.Erase)
                        {
                            DeleteChunkIfEmpty(ctx, chunk);
                        }
                    }
                }
            }
        }
    }
}