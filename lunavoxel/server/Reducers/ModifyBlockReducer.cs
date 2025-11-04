using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void ModifyBlock(ReducerContext ctx, string projectId, BlockModificationMode mode, byte[] diffData, int layerIndex)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        if (layer.Locked) return;

        // Process diff data by iterating in place and updating chunks as we go
        Chunk currentChunk = null;
        var currentChunkMinPos = new Vector3(-1, -1, -1);
        byte[] currentVoxels = null;
        bool chunkModified = false;

        for (int i = 0; i < diffData.Length; i++)
        {
            if (diffData[i] != 0)
            {
                var position = FlatIndexTo3DPosition(i, layer.yDim, layer.zDim);
                var chunkMinPos = CalculateChunkMinPosition(position);

                // Load new chunk if we've moved to a different chunk
                if (currentChunk == null || 
                    currentChunkMinPos.X != chunkMinPos.X || 
                    currentChunkMinPos.Y != chunkMinPos.Y || 
                    currentChunkMinPos.Z != chunkMinPos.Z)
                {
                    // Save previous chunk if it was modified
                    if (currentChunk != null && chunkModified)
                    {
                        currentChunk.Voxels = VoxelCompression.Compress(currentVoxels);
                        ctx.Db.chunk.Id.Update(currentChunk);
                        if (mode == BlockModificationMode.Erase)
                        {
                            DeleteChunkIfEmpty(ctx, currentChunk);
                        }
                    }

                    // Load next chunk
                    currentChunk = GetOrCreateChunk(ctx, layer.Id, position, layer);
                    currentChunkMinPos = chunkMinPos;
                    currentVoxels = VoxelCompression.Decompress(currentChunk.Voxels);
                    chunkModified = false;
                }

                // Update voxel in current chunk
                var localPos = new Vector3(
                    position.X - currentChunk.MinPosX,
                    position.Y - currentChunk.MinPosY,
                    position.Z - currentChunk.MinPosZ
                );
                var index = CalculateVoxelIndex(localPos, currentChunk.SizeY, currentChunk.SizeZ);
                
                byte valueToSet = mode == BlockModificationMode.Erase ? (byte)0 : diffData[i];
                currentVoxels[index] = valueToSet;
                chunkModified = true;
            }
        }

        // Save the last chunk if it was modified
        if (currentChunk != null && chunkModified)
        {
            currentChunk.Voxels = VoxelCompression.Compress(currentVoxels);
            ctx.Db.chunk.Id.Update(currentChunk);
            if (mode == BlockModificationMode.Erase)
            {
                DeleteChunkIfEmpty(ctx, currentChunk);
            }
        }

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new ArgumentException("No such project");
        if (ctx.Sender == project.Owner)
        {
            // Updated is used to find the most recent project of the user, so don't care about shared updates.
            project.Updated = ctx.Timestamp;
            ctx.Db.projects.Id.Update(project);
        }
    }
}