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
            return;
        }

        var selectionData = PerformFloodFill(ctx, layer, position, targetBlockType);
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
        var chunkCache = new Dictionary<(int, int, int), (byte[], int, int)>();

        queue.Enqueue(startPosition);
        int startIndex = CalculateWorldIndex(startPosition, layer.yDim, layer.zDim);
        visited.Add(startIndex);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            int worldIndex = CalculateWorldIndex(current, layer.yDim, layer.zDim);

            selectionData[worldIndex] = (byte)(worldIndex + 1);

            var neighbors = new[]
            {
                new Vector3(current.X - 1, current.Y, current.Z),
                new Vector3(current.X + 1, current.Y, current.Z),
                new Vector3(current.X, current.Y - 1, current.Z),
                new Vector3(current.X, current.Y + 1, current.Z),
                new Vector3(current.X, current.Y, current.Z - 1),
                new Vector3(current.X, current.Y, current.Z + 1)
            };

            foreach (var neighbor in neighbors)
            {
                if (neighbor.X < 0 || neighbor.X >= layer.xDim ||
                    neighbor.Y < 0 || neighbor.Y >= layer.yDim ||
                    neighbor.Z < 0 || neighbor.Z >= layer.zDim)
                {
                    continue;
                }

                int neighborIndex = CalculateWorldIndex(neighbor, layer.yDim, layer.zDim);
                if (visited.Contains(neighborIndex))
                {
                    continue;
                }

                byte blockType = GetVoxelAtPosition(ctx, layer.Id, neighbor, chunkCache);
                if (blockType == targetBlockType)
                {
                    visited.Add(neighborIndex);
                    queue.Enqueue(neighbor);
                }
            }
        }

        return selectionData;
    }

    private static byte GetVoxelAtPosition(
        ReducerContext ctx,
        string layerId,
        Vector3 position,
        Dictionary<(int, int, int), (byte[], int, int)> chunkCache)
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
        var localIndex = CalculateVoxelIndex(localPos, cachedData.Item2, cachedData.Item3);
        return cachedData.Item1[localIndex];
    }

    public static int CalculateWorldIndex(Vector3 position, int yDim, int zDim)
    {
        return position.X * yDim * zDim + position.Y * zDim + position.Z;
    }
}