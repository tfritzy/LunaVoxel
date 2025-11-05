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

        // Iterate through world space in chunk-sized increments
        // Only process chunks where selection data might be non-zero
        for (int chunkX = 0; chunkX < layer.xDim; chunkX += MAX_CHUNK_SIZE)
        {
            for (int chunkY = 0; chunkY < layer.yDim; chunkY += MAX_CHUNK_SIZE)
            {
                for (int chunkZ = 0; chunkZ < layer.zDim; chunkZ += MAX_CHUNK_SIZE)
                {
                    // Check if this chunk region has any selection data
                    bool hasSelection = false;
                    int chunkEndX = Math.Min(chunkX + MAX_CHUNK_SIZE, layer.xDim);
                    int chunkEndY = Math.Min(chunkY + MAX_CHUNK_SIZE, layer.yDim);
                    int chunkEndZ = Math.Min(chunkZ + MAX_CHUNK_SIZE, layer.zDim);
                    
                    for (int x = chunkX; x < chunkEndX && !hasSelection; x++)
                    {
                        for (int y = chunkY; y < chunkEndY && !hasSelection; y++)
                        {
                            for (int z = chunkZ; z < chunkEndZ && !hasSelection; z++)
                            {
                                int index = x * layer.yDim * layer.zDim + y * layer.zDim + z;
                                if (selectionData[index] != 0)
                                {
                                    hasSelection = true;
                                }
                            }
                        }
                    }
                    
                    if (!hasSelection) continue;
                    
                    // Load the chunk if it exists
                    var chunkMinPos = new Vector3(chunkX, chunkY, chunkZ);
                    var chunk = ctx.Db.chunk.chunk_layer_pos
                        .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                        .FirstOrDefault();
                    
                    if (chunk == null) continue; // No chunk means already empty
                    
                    var voxels = VoxelCompression.Decompress(chunk.Voxels);
                    bool modified = false;
                    
                    // Process voxels in this chunk
                    for (int x = chunkX; x < chunkEndX; x++)
                    {
                        for (int y = chunkY; y < chunkEndY; y++)
                        {
                            for (int z = chunkZ; z < chunkEndZ; z++)
                            {
                                int worldIndex = x * layer.yDim * layer.zDim + y * layer.zDim + z;
                                if (selectionData[worldIndex] != 0)
                                {
                                    var localPos = new Vector3(x - chunkX, y - chunkY, z - chunkZ);
                                    var localIndex = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
                                    voxels[localIndex] = 0;
                                    modified = true;
                                }
                            }
                        }
                    }
                    
                    if (modified)
                    {
                        chunk.Voxels = VoxelCompression.Compress(voxels);
                        ctx.Db.chunk.Id.Update(chunk);
                        DeleteChunkIfEmpty(ctx, chunk);
                    }
                }
            }
        }

        // Delete the selection after applying it
        ctx.Db.selections.Id.Delete(selection.Id);
    }
}
