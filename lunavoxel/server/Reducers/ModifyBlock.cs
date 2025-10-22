using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;
public static partial class Module
{
    [Reducer]
    public static void ModifyBlockAmorphous(
        ReducerContext ctx,
        string projectId,
        Vector3 diffMin,
        Vector3 diffMax,
        byte[] compressedDiffData,
        int layerIndex)
    {

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
             ?? throw new ArgumentException("No layer for this project");
        var diffData = VoxelCompression.Decompress(compressedDiffData);
        ModifyBlock(ctx, projectId, diffMin, diffMax, diffData, layerIndex);
    }

    public static void ModifyBlock(ReducerContext ctx, string projectId, Vector3 diffMin, Vector3 diffMax, uint[] diffData, int layerIndex)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        if (layer.Locked) return;

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new ArgumentException("No such project");

        // Ensure diffMin is actually the minimum and diffMax is actually the maximum
        int actualMinX = Math.Min(diffMin.X, diffMax.X);
        int actualMaxX = Math.Max(diffMin.X, diffMax.X);
        int actualMinY = Math.Min(diffMin.Y, diffMax.Y);
        int actualMaxY = Math.Max(diffMin.Y, diffMax.Y);
        int actualMinZ = Math.Min(diffMin.Z, diffMax.Z);
        int actualMaxZ = Math.Max(diffMin.Z, diffMax.Z);

        // Calculate which chunks are affected by the diff
        int chunkMinX = actualMinX / CHUNK_SIZE;
        int chunkMaxX = actualMaxX / CHUNK_SIZE;
        int chunkMinZ = actualMinZ / CHUNK_SIZE;
        int chunkMaxZ = actualMaxZ / CHUNK_SIZE;

        for (int chunkX = chunkMinX; chunkX <= chunkMaxX; chunkX++)
        {
            for (int chunkZ = chunkMinZ; chunkZ <= chunkMaxZ; chunkZ++)
            {
                int chunkStartX = chunkX * CHUNK_SIZE;
                int chunkStartZ = chunkZ * CHUNK_SIZE;

                // Load the specific chunk we need using the index
                var chunk = ctx.Db.chunk.chunk_location.Filter((projectId, layer.Id, chunkStartX, chunkStartZ)).FirstOrDefault();
                
                // If chunk doesn't exist, create it
                if (chunk == null)
                {
                    chunk = Chunk.Build(projectId, layer.Id, chunkStartX, chunkStartZ, layer.yDim);
                    ctx.Db.chunk.Insert(chunk);
                }

                // Decompress chunk voxels
                uint[] chunkVoxels = VoxelCompression.Decompress(chunk.Voxels);

                // Calculate the intersection of the diff bounds with this chunk
                int localMinX = Math.Max(0, actualMinX - chunkStartX);
                int localMaxX = Math.Min(CHUNK_SIZE - 1, actualMaxX - chunkStartX);
                int localMinZ = Math.Max(0, actualMinZ - chunkStartZ);
                int localMaxZ = Math.Min(CHUNK_SIZE - 1, actualMaxZ - chunkStartZ);
                int localMinY = actualMinY;
                int localMaxY = actualMaxY;

                // Apply diff data to chunk
                for (int y = localMinY; y <= localMaxY; y++)
                {
                    for (int z = localMinZ; z <= localMaxZ; z++)
                    {
                        for (int x = localMinX; x <= localMaxX; x++)
                        {
                            // Calculate index in the chunk's voxel array
                            int chunkIndex = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;

                            // Calculate world coordinates
                            int worldX = chunkStartX + x;
                            int worldZ = chunkStartZ + z;

                            // Calculate index in the diff data array
                            int diffX = worldX - actualMinX;
                            int diffY = y - actualMinY;
                            int diffZ = worldZ - actualMinZ;

                            int diffWidth = actualMaxX - actualMinX + 1;
                            int diffHeight = actualMaxY - actualMinY + 1;
                            int diffDepth = actualMaxZ - actualMinZ + 1;

                            int diffIndex = diffY * diffWidth * diffDepth + diffZ * diffWidth + diffX;

                            // Apply the diff if it's non-zero
                            if (diffIndex >= 0 && diffIndex < diffData.Length && diffData[diffIndex] != 0)
                            {
                                chunkVoxels[chunkIndex] = diffData[diffIndex];
                            }
                        }
                    }
                }

                // Compress and update the chunk
                chunk.Voxels = VoxelCompression.Compress(chunkVoxels);
                ctx.Db.chunk.Id.Update(chunk);
            }
        }

        if (ctx.Sender == project.Owner)
        {
            // Updated is used to find the most recent project of the user, so don't care about shared updates.
            project.Updated = ctx.Timestamp;
            ctx.Db.projects.Id.Update(project);
        }
    }
}