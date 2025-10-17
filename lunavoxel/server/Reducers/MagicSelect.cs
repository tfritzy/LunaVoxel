using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void MagicSelect(ReducerContext ctx, string projectId, int layerIndex, Vector3 position)
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

        var layerVoxels = VoxelCompression.Decompress(layer.Voxels);
        Log.Info($"Decompressed {layerVoxels.Length} voxels from layer");

        int clickedIndex = position.X * layer.yDim * layer.zDim + position.Y * layer.zDim + position.Z;
        uint clickedVoxel = layerVoxels[clickedIndex];
        uint targetBlockType = VoxelDataUtils.GetBlockType(clickedVoxel);

        Log.Info($"Clicked voxel - Index: {clickedIndex}, Block type: {targetBlockType}");

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
        var selectionData = FloodFillSelect(
            layerVoxels,
            layer.xDim,
            layer.yDim,
            layer.zDim,
            position,
            targetBlockType
        );

        int selectedCount = selectionData.Count(v => v == 1);
        Log.Info($"Flood fill complete - Selected {selectedCount} voxels");

        var compressedSelection = VoxelCompression.Compress(selectionData);
        Log.Info($"Compressed selection - Original size: {selectionData.Length * 4} bytes, Compressed: {compressedSelection.Length} bytes");

        if (existingSelection != null)
        {
            existingSelection.SelectionData = compressedSelection;
            ctx.Db.selections.Id.Update(existingSelection);
            Log.Info($"Updated existing selection {existingSelection.Id}");
        }
        else
        {
            var newSelection = new Selections
            {
                Id = IdGenerator.Generate("sel"),
                Identity = ctx.Sender,
                ProjectId = projectId,
                SelectionData = compressedSelection
            };
            ctx.Db.selections.Insert(newSelection);
            Log.Info($"Created new selection {newSelection.Id} for user");
        }

        Log.Info($"MagicSelect completed successfully - {selectedCount} voxels selected");
    }

    private static uint[] FloodFillSelect(
        uint[] voxels,
        int xDim,
        int yDim,
        int zDim,
        Vector3 startPos,
        uint targetBlockType)
    {
        var selectionData = new uint[voxels.Length];
        var visited = new bool[voxels.Length];
        var queue = new Queue<(int x, int y, int z)>();

        queue.Enqueue((startPos.X, startPos.Y, startPos.Z));
        int startIndex = startPos.X * yDim * zDim + startPos.Y * zDim + startPos.Z;
        visited[startIndex] = true;

        int[] dx = { 1, -1, 0, 0, 0, 0 };
        int[] dy = { 0, 0, 1, -1, 0, 0 };
        int[] dz = { 0, 0, 0, 0, 1, -1 };

        int processedCount = 0;
        int selectedCount = 0;

        while (queue.Count > 0)
        {
            var (x, y, z) = queue.Dequeue();
            int currentIndex = x * yDim * zDim + y * zDim + z;
            processedCount++;

            uint currentVoxel = voxels[currentIndex];
            uint currentBlockType = VoxelDataUtils.GetBlockType(currentVoxel);

            if (currentBlockType != targetBlockType)
            {
                continue;
            }

            selectionData[currentIndex] = 1;
            selectedCount++;

            for (int i = 0; i < 6; i++)
            {
                int nx = x + dx[i];
                int ny = y + dy[i];
                int nz = z + dz[i];

                if (nx >= 0 && nx < xDim &&
                    ny >= 0 && ny < yDim &&
                    nz >= 0 && nz < zDim)
                {
                    int neighborIndex = nx * yDim * zDim + ny * zDim + nz;

                    if (!visited[neighborIndex])
                    {
                        visited[neighborIndex] = true;
                        uint neighborVoxel = voxels[neighborIndex];
                        uint neighborBlockType = VoxelDataUtils.GetBlockType(neighborVoxel);

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