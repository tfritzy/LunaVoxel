using SpacetimeDB;
using System;
using System.Linq;
using System.Collections.Generic;

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

        // Group voxels to delete by chunks to minimize chunk loads
        var chunkUpdates = new Dictionary<string, List<Vector3>>();

        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
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
                    chunkUpdates[chunkKey] = new List<Vector3>();
                }

                chunkUpdates[chunkKey].Add(position);
            }
        }

        // Apply deletions to each affected chunk
        foreach (var kvp in chunkUpdates)
        {
            var firstPos = kvp.Value[0];
            var chunkMinPos = new Vector3(
                (firstPos.X / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
                (firstPos.Y / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE,
                (firstPos.Z / MAX_CHUNK_SIZE) * MAX_CHUNK_SIZE
            );

            var chunk = ctx.Db.chunk.chunk_layer_pos
                .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                .FirstOrDefault();

            if (chunk == null)
            {
                continue; // No chunk means voxels are already empty
            }

            var voxels = VoxelCompression.Decompress(chunk.Voxels);

            foreach (var pos in kvp.Value)
            {
                // Calculate local position within chunk
                var localPos = new Vector3(
                    pos.X - chunk.MinPosX,
                    pos.Y - chunk.MinPosY,
                    pos.Z - chunk.MinPosZ
                );
                var index = localPos.X * chunk.SizeY * chunk.SizeZ + localPos.Y * chunk.SizeZ + localPos.Z;
                voxels[index] = 0; // Set to empty/air block
            }

            chunk.Voxels = VoxelCompression.Compress(voxels);
            ctx.Db.chunk.Id.Update(chunk);

            // Delete chunk if it becomes completely empty
            DeleteChunkIfEmpty(ctx, chunk);
        }

        // Delete the selection after applying it
        ctx.Db.selections.Id.Delete(selection.Id);
    }
}
