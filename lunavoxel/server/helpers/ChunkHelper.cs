using System;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    public const int MAX_CHUNK_SIZE = 32;

    /// <summary>
    /// Calculate the chunk minimum position for a given world position
    /// </summary>
    public static Vector3 CalculateChunkMinPosition(Vector3 position)
    {
        return new Vector3(
            (position.X / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
            (position.Y / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
            (position.Z / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE
        );
    }

    /// <summary>
    /// Calculate the voxel index within a chunk
    /// </summary>
    public static int CalculateVoxelIndex(Vector3 localPos, int sizeY, int sizeZ)
    {
        return localPos.X * sizeY * sizeZ + localPos.Y * sizeZ + localPos.Z;
    }

    /// <summary>
    /// Convert a flat index to 3D position
    /// </summary>
    public static Vector3 FlatIndexTo3DPosition(int index, int yDim, int zDim)
    {
        return new Vector3(
            index / (yDim * zDim),
            (index % (yDim * zDim)) / zDim,
            index % zDim
        );
    }

    /// <summary>
    /// Create a chunk key for grouping operations
    /// </summary>
    public static string GetChunkKey(Vector3 chunkMinPos)
    {
        return $"{chunkMinPos.X},{chunkMinPos.Y},{chunkMinPos.Z}";
    }

    /// <summary>
    /// Get or create a chunk that contains the given position.
    /// Chunks are created on-demand when needed.
    /// </summary>
    public static Chunk GetOrCreateChunk(ReducerContext ctx, string layerId, Vector3 position, Layer layer)
    {
        // Calculate which chunk this position belongs to
        var chunkMinPos = CalculateChunkMinPosition(position);

        // Try to find existing chunk
        var existingChunk = ctx.Db.chunk.chunk_layer_pos
            .Filter((layerId, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
            .FirstOrDefault();

        if (existingChunk != null)
        {
            return existingChunk;
        }

        // Calculate chunk size (bounded by layer dimensions)
        var chunkSize = new Vector3(
            Math.Min(MAX_CHUNK_SIZE, layer.xDim - chunkMinPos.X),
            Math.Min(MAX_CHUNK_SIZE, layer.yDim - chunkMinPos.Y),
            Math.Min(MAX_CHUNK_SIZE, layer.zDim - chunkMinPos.Z)
        );

        // Create new chunk
        var newChunk = Chunk.Build(layerId, chunkMinPos, chunkSize);
        ctx.Db.chunk.Insert(newChunk);
        
        return newChunk;
    }

    /// <summary>
    /// Get voxel at position from chunks. Returns 0 if no chunk exists at that position.
    /// </summary>
    public static byte GetVoxelFromChunks(ReducerContext ctx, string layerId, Vector3 position)
    {
        var chunkMinPos = CalculateChunkMinPosition(position);

        var chunk = ctx.Db.chunk.chunk_layer_pos
            .Filter((layerId, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
            .FirstOrDefault();

        if (chunk == null)
        {
            return 0; // No chunk means empty voxel
        }

        // Calculate local position within chunk
        var localPos = new Vector3(
            position.X - chunkMinPos.X,
            position.Y - chunkMinPos.Y,
            position.Z - chunkMinPos.Z
        );

        var voxels = VoxelCompression.Decompress(chunk.Voxels);
        var index = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
        
        return voxels[index];
    }

    /// <summary>
    /// Set voxel at position in chunks. Creates chunk if it doesn't exist.
    /// </summary>
    public static void SetVoxelInChunk(ReducerContext ctx, string layerId, Vector3 position, byte value, Layer layer)
    {
        var chunk = GetOrCreateChunk(ctx, layerId, position, layer);

        // Calculate local position within chunk
        var localPos = new Vector3(
            position.X - chunk.MinPosX,
            position.Y - chunk.MinPosY,
            position.Z - chunk.MinPosZ
        );

        var voxels = VoxelCompression.Decompress(chunk.Voxels);
        var index = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
        
        voxels[index] = value;
        chunk.Voxels = VoxelCompression.Compress(voxels);
        ctx.Db.chunk.Id.Update(chunk);
    }

    /// <summary>
    /// Get all chunks for a layer
    /// </summary>
    public static System.Collections.Generic.List<Chunk> GetLayerChunks(ReducerContext ctx, string layerId)
    {
        return ctx.Db.chunk.chunk_layer.Filter(layerId).ToList();
    }

    /// <summary>
    /// Delete all chunks for a layer
    /// </summary>
    public static void DeleteLayerChunks(ReducerContext ctx, string layerId)
    {
        var chunks = GetLayerChunks(ctx, layerId);
        foreach (var chunk in chunks)
        {
            ctx.Db.chunk.Id.Delete(chunk.Id);
        }
    }

    /// <summary>
    /// Check if a chunk is empty (all voxels are 0)
    /// </summary>
    public static bool IsChunkEmpty(Chunk chunk)
    {
        var voxels = VoxelCompression.Decompress(chunk.Voxels);
        foreach (var voxel in voxels)
        {
            if (voxel != 0)
            {
                return false;
            }
        }
        return true;
    }

    /// <summary>
    /// Delete a chunk if it's empty
    /// </summary>
    public static void DeleteChunkIfEmpty(ReducerContext ctx, Chunk chunk)
    {
        if (IsChunkEmpty(chunk))
        {
            ctx.Db.chunk.Id.Delete(chunk.Id);
        }
    }
}
