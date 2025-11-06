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
    /// Get or create a chunk that contains the given position.
    /// Chunks are created on-demand when needed.
    /// </summary>
    public static Chunk GetOrCreateChunk(ReducerContext ctx, string layerId, Vector3 position, Layer layer)
    {
        var chunkMinPos = CalculateChunkMinPosition(position);

        var existingChunk = ctx.Db.chunk.chunk_layer_pos
            .Filter((layerId, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
            .FirstOrDefault();

        if (existingChunk != null)
        {
            return existingChunk;
        }

        var chunkSize = new Vector3(
            Math.Min(MAX_CHUNK_SIZE, layer.xDim - chunkMinPos.X),
            Math.Min(MAX_CHUNK_SIZE, layer.yDim - chunkMinPos.Y),
            Math.Min(MAX_CHUNK_SIZE, layer.zDim - chunkMinPos.Z)
        );

        var newChunk = Chunk.Build(layer.ProjectId, layerId, chunkMinPos, chunkSize);
        ctx.Db.chunk.Insert(newChunk);
        
        return newChunk;
    }
}
