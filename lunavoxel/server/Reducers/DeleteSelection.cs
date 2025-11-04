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
                var position = FlatIndexTo3DPosition(i, layer.yDim, layer.zDim);

                // Calculate chunk identifier
                var chunkMinPos = CalculateChunkMinPosition(position);
                var chunkKey = GetChunkKey(chunkMinPos);

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
            var chunkMinPos = CalculateChunkMinPosition(firstPos);

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
                var index = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
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
