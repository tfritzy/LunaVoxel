using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void MagicSelect(ReducerContext ctx, string projectId, int layerIndex, Vector3 position)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {layerIndex}");

        if (layer.Locked)
        {
            Log.Info($"Layer {layer.Id} is locked - cannot create selection");
            throw new InvalidOperationException("Cannot create selection on a locked layer");
        }

        if (position.X < 0 || position.X >= layer.xDim ||
            position.Y < 0 || position.Y >= layer.yDim ||
            position.Z < 0 || position.Z >= layer.zDim)
        {
            Log.Info($"Position {position.X},{position.Y},{position.Z} is out of bounds");
            throw new ArgumentException("Position is out of layer bounds");
        }

        var chunkMinPos = CalculateChunkMinPosition(position);
        var chunk = ctx.Db.chunk.chunk_layer_pos
            .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
            .FirstOrDefault();

        byte targetBlockType;
        if (chunk == null)
        {
            targetBlockType = 0;
        }
        else
        {
            var voxels = VoxelCompression.Decompress(chunk.Voxels);
            var localPos = new Vector3(position.X - chunkMinPos.X, position.Y - chunkMinPos.Y, position.Z - chunkMinPos.Z);
            var localIndex = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
            targetBlockType = voxels[localIndex];
        }

        if (targetBlockType == 0)
        {
            Log.Info("Cannot select empty voxels");
            throw new InvalidOperationException("Cannot create selection on empty voxels");
        }

        Log.Info($"Starting magic select flood fill for block type {targetBlockType} at position {position.X},{position.Y},{position.Z}");
        var selectionData = PerformFloodFill(ctx, layer, position, targetBlockType);
        Log.Info($"Flood fill completed, compressing selection data");
        var compressedSelection = VoxelCompression.Compress(selectionData);

        var existingSelection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (existingSelection != null)
        {
            existingSelection.Layer = layerIndex;
            existingSelection.SelectionData = compressedSelection;
            ctx.Db.selections.Id.Update(existingSelection);
        }
        else
        {
            var newSelection = new Selection
            {
                Id = IdGenerator.Generate("sel"),
                Identity = ctx.Sender,
                ProjectId = projectId,
                Layer = layerIndex,
                SelectionData = compressedSelection
            };
            ctx.Db.selections.Insert(newSelection);
        }
    }

    private static byte[] PerformFloodFill(ReducerContext ctx, Layer layer, Vector3 startPosition, byte targetBlockType)
    {
        var totalVoxels = layer.xDim * layer.yDim * layer.zDim;
        var selectionData = new byte[totalVoxels];
        var visited = new HashSet<int>();
        var queue = new Queue<Vector3>();
        var chunkCache = new Dictionary<(int, int, int), (byte[] voxels, int sizeY, int sizeZ)>();

        queue.Enqueue(startPosition);
        int startIndex = CalculateWorldIndex(startPosition, layer.yDim, layer.zDim);
        visited.Add(startIndex);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            int worldIndex = CalculateWorldIndex(current, layer.yDim, layer.zDim);

            selectionData[worldIndex] = (byte)(worldIndex + 1);

            CheckAndEnqueueNeighbor(ctx, layer, current.X - 1, current.Y, current.Z, visited, queue, chunkCache, targetBlockType);
            CheckAndEnqueueNeighbor(ctx, layer, current.X + 1, current.Y, current.Z, visited, queue, chunkCache, targetBlockType);
            CheckAndEnqueueNeighbor(ctx, layer, current.X, current.Y - 1, current.Z, visited, queue, chunkCache, targetBlockType);
            CheckAndEnqueueNeighbor(ctx, layer, current.X, current.Y + 1, current.Z, visited, queue, chunkCache, targetBlockType);
            CheckAndEnqueueNeighbor(ctx, layer, current.X, current.Y, current.Z - 1, visited, queue, chunkCache, targetBlockType);
            CheckAndEnqueueNeighbor(ctx, layer, current.X, current.Y, current.Z + 1, visited, queue, chunkCache, targetBlockType);
        }

        return selectionData;
    }

    private static void CheckAndEnqueueNeighbor(
        ReducerContext ctx,
        Layer layer,
        int x, int y, int z,
        HashSet<int> visited,
        Queue<Vector3> queue,
        Dictionary<(int, int, int), (byte[] voxels, int sizeY, int sizeZ)> chunkCache,
        byte targetBlockType)
    {
        if (x < 0 || x >= layer.xDim ||
            y < 0 || y >= layer.yDim ||
            z < 0 || z >= layer.zDim)
        {
            return;
        }

        int neighborIndex = CalculateWorldIndex(new Vector3(x, y, z), layer.yDim, layer.zDim);
        if (visited.Contains(neighborIndex))
        {
            return;
        }

        var neighbor = new Vector3(x, y, z);
        byte blockType = GetVoxelAtPosition(ctx, layer.Id, neighbor, chunkCache);
        if (blockType == targetBlockType)
        {
            visited.Add(neighborIndex);
            queue.Enqueue(neighbor);
        }
    }

    private static byte GetVoxelAtPosition(
        ReducerContext ctx,
        string layerId,
        Vector3 position,
        Dictionary<(int, int, int), (byte[] voxels, int sizeY, int sizeZ)> chunkCache)
    {
        var chunkMinPos = CalculateChunkMinPosition(position);
        var cacheKey = (chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z);

        if (!chunkCache.TryGetValue(cacheKey, out var cachedData))
        {
            var chunk = ctx.Db.chunk.chunk_layer_pos
                .Filter((layerId, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                .FirstOrDefault();

            if (chunk == null)
            {
                return 0;
            }

            var voxels = VoxelCompression.Decompress(chunk.Voxels);
            cachedData = (voxels, chunk.SizeY, chunk.SizeZ);
            chunkCache[cacheKey] = cachedData;
        }

        var localPos = new Vector3(position.X - chunkMinPos.X, position.Y - chunkMinPos.Y, position.Z - chunkMinPos.Z);
        var localIndex = CalculateVoxelIndex(localPos, cachedData.sizeY, cachedData.sizeZ);
        return cachedData.voxels[localIndex];
    }

    public static int CalculateWorldIndex(Vector3 position, int yDim, int zDim)
    {
        return position.X * yDim * zDim + position.Y * zDim + position.Z;
    }
}