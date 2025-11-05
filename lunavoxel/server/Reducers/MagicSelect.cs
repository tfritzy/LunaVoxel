using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void MagicSelect(ReducerContext ctx, string projectId, int layerIndex, Vector3 position)
    {
        Log.Warn("MagicSelect reducer is deprecated and not implemented for chunk-based storage");
        // TODO: Implement MagicSelect for chunk-based storage
        // Requires loading all chunks upfront and performing BFS efficiently
    }

    [Reducer]
    public static void MagicSelect_OLD_DEPRECATED(ReducerContext ctx, string projectId, int layerIndex, Vector3 position)
    {
        Log.Info($"MagicSelect started - Project: {projectId}, Layer: {layerIndex}, Position: ({position.X}, {position.Y}, {position.Z})");

        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {layerIndex}");

        Log.Info($"Layer found - Dimensions: {layer.xDim}x{layer.yDim}x{layer.zDim}");

        if (position.X < 0 || position.X >= layer.xDim ||
            position.Y < 0 || position.Y >= layer.yDim ||
            position.Z < 0 || position.Z >= layer.zDim)
        {
            Log.Error($"Position out of bounds - Position: ({position.X}, {position.Y}, {position.Z}), Layer bounds: ({layer.xDim}, {layer.yDim}, {layer.zDim})");
            throw new ArgumentOutOfRangeException(nameof(position), "Position is outside layer bounds");
        }

        var existingSelection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        if (existingSelection != null)
        {
            Log.Info($"Found existing selection for user - Selection ID: {existingSelection.Id}");
        }

        byte clickedVoxel = GetVoxelFromChunks(ctx, layer.Id, position);
        byte targetBlockType = VoxelDataUtils.GetBlockType(clickedVoxel);

        Log.Info($"Clicked voxel - Block type: {targetBlockType}");

        if (targetBlockType == 0)
        {
            Log.Info("Clicked on empty block - clearing selection");
            if (existingSelection != null)
            {
                ctx.Db.selections.Id.Delete(existingSelection.Id);
                Log.Info($"Deleted selection {existingSelection.Id}");
            }
            return;
        }

        Log.Info($"Starting flood fill for block type {targetBlockType}");
        var selectionData = FloodFillSelectFromChunks(
            ctx,
            layer,
            position,
            targetBlockType
        );

        int selectedCount = selectionData.Count(v => v != 0);
        Log.Info($"Flood fill complete - Selected {selectedCount} voxels");

        var compressedSelection = VoxelCompression.Compress(selectionData);
        Log.Info($"Compressed selection - Original size: {selectionData.Length} bytes, Compressed: {compressedSelection.Length} bytes");

        if (existingSelection != null)
        {
            existingSelection.SelectionData = compressedSelection;
            ctx.Db.selections.Id.Update(existingSelection);
            Log.Info($"Updated existing selection {existingSelection.Id}");
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
            Log.Info($"Created new selection {newSelection.Id} for user");
        }

        Log.Info($"MagicSelect completed successfully - {selectedCount} voxels selected");
    }

    private static byte[] FloodFillSelectFromChunks(
        ReducerContext ctx,
        Layer layer,
        Vector3 startPos,
        byte targetBlockType)
    {
        var selectionData = new byte[layer.xDim * layer.yDim * layer.zDim];
        var visited = new bool[layer.xDim * layer.yDim * layer.zDim];
        var queue = new Queue<(int x, int y, int z)>();

        // Cache for loaded chunks
        var chunkCache = new Dictionary<string, byte[]>();

        queue.Enqueue((startPos.X, startPos.Y, startPos.Z));
        int startIndex = startPos.X * layer.yDim * layer.zDim + startPos.Y * layer.zDim + startPos.Z;
        visited[startIndex] = true;

        int[] dx = { 1, -1, 0, 0, 0, 0 };
        int[] dy = { 0, 0, 1, -1, 0, 0 };
        int[] dz = { 0, 0, 0, 0, 1, -1 };

        int processedCount = 0;
        int selectedCount = 0;

        while (queue.Count > 0)
        {
            var (x, y, z) = queue.Dequeue();
            int currentIndex = x * layer.yDim * layer.zDim + y * layer.zDim + z;
            processedCount++;

            var position = new Vector3(x, y, z);
            var chunkMinPos = CalculateChunkMinPosition(position);
            var chunkKey = $"{chunkMinPos.X},{chunkMinPos.Y},{chunkMinPos.Z}";
            
            // Load chunk into cache if not already loaded
            if (!chunkCache.ContainsKey(chunkKey))
            {
                var chunk = ctx.Db.chunk.chunk_layer_pos
                    .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                    .FirstOrDefault();
                
                if (chunk == null)
                {
                    chunkCache[chunkKey] = null; // Empty chunk
                }
                else
                {
                    chunkCache[chunkKey] = VoxelCompression.Decompress(chunk.Voxels);
                }
            }
            
            byte currentVoxel = 0;
            var cachedVoxels = chunkCache[chunkKey];
            if (cachedVoxels != null)
            {
                var localPos = new Vector3(x - chunkMinPos.X, y - chunkMinPos.Y, z - chunkMinPos.Z);
                var chunk = ctx.Db.chunk.chunk_layer_pos
                    .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                    .FirstOrDefault();
                if (chunk != null)
                {
                    var localIndex = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
                    currentVoxel = cachedVoxels[localIndex];
                }
            }
            
            byte currentBlockType = VoxelDataUtils.GetBlockType(currentVoxel);

            if (currentBlockType != targetBlockType)
            {
                continue;
            }

            selectionData[currentIndex] = (byte)(currentIndex + 1);
            selectedCount++;

            for (int i = 0; i < 6; i++)
            {
                int nx = x + dx[i];
                int ny = y + dy[i];
                int nz = z + dz[i];

                if (nx >= 0 && nx < layer.xDim &&
                    ny >= 0 && ny < layer.yDim &&
                    nz >= 0 && nz < layer.zDim)
                {
                    int neighborIndex = nx * layer.yDim * layer.zDim + ny * layer.zDim + nz;

                    if (!visited[neighborIndex])
                    {
                        visited[neighborIndex] = true;
                        var neighborPos = new Vector3(nx, ny, nz);
                        byte neighborVoxel = GetVoxelFromChunks(ctx, layer.Id, neighborPos);
                        byte neighborBlockType = VoxelDataUtils.GetBlockType(neighborVoxel);

                        if (neighborBlockType == targetBlockType)
                        {
                            queue.Enqueue((nx, ny, nz));
                        }
                    }
                }
            }

            if (processedCount % 1000 == 0)
            {
                Log.Debug($"Flood fill progress - Processed: {processedCount}, Selected: {selectedCount}, Queue size: {queue.Count}");
            }
        }

        Log.Debug($"Flood fill complete - Total processed: {processedCount}, Total selected: {selectedCount}");
        return selectionData;
    }
}