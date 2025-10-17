using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void MagicSelect(ReducerContext ctx, string projectId, int layerIndex, Vector3 position)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {layerIndex}");

        if (position.X < 0 || position.X >= layer.xDim ||
            position.Y < 0 || position.Y >= layer.yDim ||
            position.Z < 0 || position.Z >= layer.zDim)
        {
            throw new ArgumentOutOfRangeException(nameof(position), "Position is outside layer bounds");
        }

        var existingSelection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();

        var layerVoxels = VoxelCompression.Decompress(layer.Voxels);

        int clickedIndex = position.X * layer.yDim * layer.zDim + position.Y * layer.zDim + position.Z;
        uint clickedVoxel = layerVoxels[clickedIndex];
        uint targetBlockType = VoxelDataUtils.GetBlockType(clickedVoxel);

        if (targetBlockType == 0)
        {
            if (existingSelection != null)
            {
                ctx.Db.selections.Id.Delete(existingSelection.Id);
            }
            return;
        }

        var selectionData = FloodFillSelect(
            layerVoxels,
            layer.xDim,
            layer.yDim,
            layer.zDim,
            position,
            targetBlockType
        );

        var compressedSelection = VoxelCompression.Compress(selectionData);

        if (existingSelection != null)
        {
            existingSelection.SelectionData = compressedSelection;
            ctx.Db.selections.Id.Update(existingSelection);
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
        }
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

        while (queue.Count > 0)
        {
            var (x, y, z) = queue.Dequeue();
            int currentIndex = x * yDim * zDim + y * zDim + z;

            uint currentVoxel = voxels[currentIndex];
            uint currentBlockType = VoxelDataUtils.GetBlockType(currentVoxel);

            if (currentBlockType != targetBlockType)
            {
                continue;
            }

            selectionData[currentIndex] = 1;

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
        }

        return selectionData;
    }
}