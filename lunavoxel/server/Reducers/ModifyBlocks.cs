using System;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void ModifyBlocks(
        ReducerContext ctx,
        string projectId,
        BlockModificationMode mode,
        Vector3 minPos,
        Vector3 maxPos,
        byte[] compressedVoxelData,
        int layerIndex)
    {
        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        int minX = Math.Max(0, Math.Min(minPos.X, maxPos.X));
        int minY = Math.Max(0, Math.Min(minPos.Y, maxPos.Y));
        int minZ = Math.Max(0, Math.Min(minPos.Z, maxPos.Z));

        int maxX = Math.Min(layer.xDim - 1, Math.Max(minPos.X, maxPos.X));
        int maxY = Math.Min(layer.yDim - 1, Math.Max(minPos.Y, maxPos.Y));
        int maxZ = Math.Min(layer.zDim - 1, Math.Max(minPos.Z, maxPos.Z));

        int regionWidth = maxX - minX + 1;
        int regionHeight = maxY - minY + 1;
        int regionDepth = maxZ - minZ + 1;
        int expectedVoxelCount = regionWidth * regionHeight * regionDepth;

        var voxelData = VoxelCompression.Decompress(compressedVoxelData);

        if (voxelData.Length != expectedVoxelCount)
        {
            throw new ArgumentException(
                $"Voxel data length ({voxelData.Length}) does not match region size ({expectedVoxelCount})");
        }

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
                    var chunkVoxels = VoxelCompression.Decompress(chunk.Voxels);
                    bool chunkModified = false;

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
                                int worldX = chunkX + x;
                                int worldY = chunkY + y;
                                int worldZ = chunkZ + z;

                                int regionX = worldX - minX;
                                int regionY = worldY - minY;
                                int regionZ = worldZ - minZ;
                                int voxelDataIndex = regionX * regionHeight * regionDepth + regionY * regionDepth + regionZ;

                                byte newValue = voxelData[voxelDataIndex];

                                if (newValue == 0)
                                {
                                    continue;
                                }

                                var chunkIndex = CalculateVoxelIndex(new Vector3(x, y, z), chunk.SizeY, chunk.SizeZ);

                                byte valueToSet;
                                if (mode == BlockModificationMode.Erase)
                                {
                                    valueToSet = 0;
                                }
                                else if (mode == BlockModificationMode.Paint)
                                {
                                    if (chunkVoxels[chunkIndex] == 0)
                                    {
                                        continue;
                                    }
                                    valueToSet = newValue;
                                }
                                else
                                {
                                    valueToSet = newValue;
                                }

                                chunkVoxels[chunkIndex] = valueToSet;
                                chunkModified = true;
                            }
                        }
                    }

                    if (chunkModified)
                    {
                        chunk.Voxels = VoxelCompression.Compress(chunkVoxels);
                        ctx.Db.chunk.Id.Update(chunk);
                    }
                }
            }
        }
    }
}
