using SpacetimeDB;
using System;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void DeleteSelection(ReducerContext ctx, string projectId)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var selection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (selection == null)
        {
            return;
        }

        var layer = ctx.Db.layer.project_index.Filter((projectId, selection.Layer)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} with layer {selection.Layer}");

        if (layer.Locked)
        {
            Log.Info($"Layer {layer.Id} is locked - cannot delete selection");
            throw new InvalidOperationException("Cannot delete selection on a locked layer");
        }

        var selectionData = VoxelCompression.Decompress(selection.SelectionData);

        // Process selection data by iterating in place and updating chunks as we go
        Chunk currentChunk = null;
        var currentChunkMinPos = new Vector3(-1, -1, -1);
        byte[] currentVoxels = null;
        bool chunkModified = false;

        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
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
                        DeleteChunkIfEmpty(ctx, currentChunk);
                    }

                    // Load next chunk
                    currentChunk = ctx.Db.chunk.chunk_layer_pos
                        .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                        .FirstOrDefault();
                    
                    if (currentChunk == null)
                    {
                        // No chunk means voxels are already empty, continue to next voxel
                        currentChunkMinPos = chunkMinPos;
                        currentVoxels = null;
                        chunkModified = false;
                        continue;
                    }

                    currentChunkMinPos = chunkMinPos;
                    currentVoxels = VoxelCompression.Decompress(currentChunk.Voxels);
                    chunkModified = false;
                }

                if (currentChunk != null && currentVoxels != null)
                {
                    // Delete voxel in current chunk
                    var localPos = new Vector3(
                        position.X - currentChunk.MinPosX,
                        position.Y - currentChunk.MinPosY,
                        position.Z - currentChunk.MinPosZ
                    );
                    var index = CalculateVoxelIndex(localPos, currentChunk.SizeY, currentChunk.SizeZ);
                    currentVoxels[index] = 0;
                    chunkModified = true;
                }
            }
        }

        // Save the last chunk if it was modified
        if (currentChunk != null && chunkModified)
        {
            currentChunk.Voxels = VoxelCompression.Compress(currentVoxels);
            ctx.Db.chunk.Id.Update(currentChunk);
            DeleteChunkIfEmpty(ctx, currentChunk);
        }

        // Delete the selection after applying it
        ctx.Db.selections.Id.Delete(selection.Id);
    }
}
