using SpacetimeDB;
using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    [Reducer]
    public static void ModifyBlock(ReducerContext ctx, string projectId, BlockModificationMode mode, byte[] diffData, int layerIndex)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        if (layer.Locked) return;

        // Group diff data by chunks to minimize chunk loads
        var chunkUpdates = new Dictionary<string, List<(Vector3 pos, byte value)>>();

        for (int i = 0; i < diffData.Length; i++)
        {
            if (diffData[i] != 0)
            {
                // Calculate 3D position from flat index
                int x = i / (layer.yDim * layer.zDim);
                int y = (i % (layer.yDim * layer.zDim)) / layer.zDim;
                int z = i % layer.zDim;
                var position = new Vector3(x, y, z);

                // Calculate chunk identifier
                var chunkMinPos = new Vector3(
                    (x / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
                    (y / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
                    (z / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE
                );
                var chunkKey = $"{chunkMinPos.X},{chunkMinPos.Y},{chunkMinPos.Z}";

                if (!chunkUpdates.ContainsKey(chunkKey))
                {
                    chunkUpdates[chunkKey] = new List<(Vector3, byte)>();
                }

                // Determine the value to set based on mode
                byte valueToSet = mode == BlockModificationMode.Erase ? (byte)0 : diffData[i];
                chunkUpdates[chunkKey].Add((position, valueToSet));
            }
        }

        // Apply updates to each affected chunk
        foreach (var kvp in chunkUpdates)
        {
            var firstPos = kvp.Value[0].pos;
            var chunk = GetOrCreateChunk(ctx, layer.Id, firstPos, layer);
            var voxels = VoxelCompression.Decompress(chunk.Voxels);

            foreach (var (pos, value) in kvp.Value)
            {
                // Calculate local position within chunk
                var localPos = new Vector3(
                    pos.X - chunk.MinPosX,
                    pos.Y - chunk.MinPosY,
                    pos.Z - chunk.MinPosZ
                );
                var index = localPos.X * chunk.SizeY * chunk.SizeZ + localPos.Y * chunk.SizeZ + localPos.Z;
                voxels[index] = value;
            }

            chunk.Voxels = VoxelCompression.Compress(voxels);
            ctx.Db.chunk.Id.Update(chunk);

            // Delete chunk if it becomes empty after erase
            if (mode == BlockModificationMode.Erase)
            {
                DeleteChunkIfEmpty(ctx, chunk);
            }
        }

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new ArgumentException("No such project");
        if (ctx.Sender == project.Owner)
        {
            // Updated is used to find the most recent project of the user, so don't care about shared updates.
            project.Updated = ctx.Timestamp;
            ctx.Db.projects.Id.Update(project);
        }
    }
}