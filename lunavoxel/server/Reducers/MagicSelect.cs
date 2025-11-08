using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void MagicSelect(ReducerContext ctx, string projectId, int layerIndex, Vector3 position)
    {
        Log.Info($"MagicSelect called at position ({position.X}, {position.Y}, {position.Z}) on layer {layerIndex}");
        
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException($"Layer not found for project {projectId} at index {layerIndex}");

        if (position.X < 0 || position.X >= layer.xDim ||
            position.Y < 0 || position.Y >= layer.yDim ||
            position.Z < 0 || position.Z >= layer.zDim)
        {
            throw new ArgumentException("Position is out of bounds");
        }

        var allChunks = ctx.Db.chunk.chunk_layer.Filter(layer.Id).ToList();
        Log.Info($"Loaded {allChunks.Count} chunks for layer {layer.Id}");
        
        var chunkCache = new Dictionary<string, (Chunk chunk, byte[] voxels)>();
        
        foreach (var chunk in allChunks)
        {
            var chunkKey = $"{chunk.MinPosX},{chunk.MinPosY},{chunk.MinPosZ}";
            chunkCache[chunkKey] = (chunk, VoxelCompression.Decompress(chunk.Voxels));
        }

        byte targetBlockType = GetVoxelAtPosition(position, chunkCache);
        Log.Info($"Target block type: {targetBlockType}");
        
        if (targetBlockType == 0)
        {
            Log.Info("Target block is empty, returning early");
            return;
        }

        var selectionData = new byte[layer.xDim * layer.yDim * layer.zDim];
        var visited = new HashSet<int>();
        var queue = new Queue<Vector3>();
        
        queue.Enqueue(position);
        int startIndex = position.X * layer.yDim * layer.zDim + position.Y * layer.zDim + position.Z;
        visited.Add(startIndex);
        selectionData[startIndex] = 1;

        Vector3[] directions = new Vector3[]
        {
            new Vector3(1, 0, 0),
            new Vector3(-1, 0, 0),
            new Vector3(0, 1, 0),
            new Vector3(0, -1, 0),
            new Vector3(0, 0, 1),
            new Vector3(0, 0, -1)
        };

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();

            foreach (var dir in directions)
            {
                var neighbor = new Vector3(
                    current.X + dir.X,
                    current.Y + dir.Y,
                    current.Z + dir.Z
                );

                if (neighbor.X < 0 || neighbor.X >= layer.xDim ||
                    neighbor.Y < 0 || neighbor.Y >= layer.yDim ||
                    neighbor.Z < 0 || neighbor.Z >= layer.zDim)
                {
                    continue;
                }

                int neighborIndex = neighbor.X * layer.yDim * layer.zDim + neighbor.Y * layer.zDim + neighbor.Z;
                
                if (visited.Contains(neighborIndex))
                {
                    continue;
                }

                byte neighborBlockType = GetVoxelAtPosition(neighbor, chunkCache);
                
                if (neighborBlockType == targetBlockType)
                {
                    visited.Add(neighborIndex);
                    selectionData[neighborIndex] = 1;
                    queue.Enqueue(neighbor);
                }
            }
        }

        Log.Info($"Flood fill complete. Selected {visited.Count} voxels");

        // Convert the global selection data into chunk-based VoxelFrames
        var selectionFrames = SelectionHelper.ConvertGlobalArrayToFrames(selectionData, layer.xDim, layer.yDim, layer.zDim);
        Log.Info($"Created {selectionFrames.Length} selection frames from {visited.Count} selected voxels");

        var existingSelection = ctx.Db.selections.Identity_ProjectId.Filter((ctx.Sender, projectId)).FirstOrDefault();
        
        if (existingSelection != null)
        {
            existingSelection.SelectionFrames = selectionFrames;
            existingSelection.Layer = layerIndex;
            ctx.Db.selections.Id.Update(existingSelection);
            Log.Info("Updated existing selection");
        }
        else
        {
            var newSelection = new Selection
            {
                Id = IdGenerator.Generate("sel"),
                Identity = ctx.Sender,
                ProjectId = projectId,
                Layer = layerIndex,
                SelectionFrames = selectionFrames
            };
            ctx.Db.selections.Insert(newSelection);
            Log.Info("Created new selection");
        }
    }

    private static byte GetVoxelAtPosition(Vector3 position, Dictionary<string, (Chunk chunk, byte[] voxels)> chunkCache)
    {
        var chunkMinPos = CalculateChunkMinPosition(position);
        var chunkKey = $"{chunkMinPos.X},{chunkMinPos.Y},{chunkMinPos.Z}";
        
        if (!chunkCache.TryGetValue(chunkKey, out var chunkData))
        {
            return 0;
        }

        var localIndex = CalculateVoxelIndex(
            position.X - chunkMinPos.X,
            position.Y - chunkMinPos.Y,
            position.Z - chunkMinPos.Z,
            chunkData.chunk.SizeY,
            chunkData.chunk.SizeZ
        );

        return chunkData.voxels[localIndex];
    }
}