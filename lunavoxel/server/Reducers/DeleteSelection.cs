using SpacetimeDB;
using System;
using System.Linq;

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
        var dimensions = new Vector3(
            selection.MaxPos.X - selection.MinPos.X,
            selection.MaxPos.Y - selection.MinPos.Y,
            selection.MaxPos.Z - selection.MinPos.Z
        );

        // Iterate over the bounded selection region
        for (int i = 0; i < selectionData.Length; i++)
        {
            if (selectionData[i] != 0)
            {
                // Get the target position where this voxel has been moved to
                int targetPosition = selectionData[i] - 1;
                
                // Convert layer-space position to world coordinates
                int worldX = targetPosition / (layer.yDim * layer.zDim);
                int worldY = (targetPosition / layer.zDim) % layer.yDim;
                int worldZ = targetPosition % layer.zDim;
                
                var position = new Vector3(worldX, worldY, worldZ);
                var chunkMinPos = CalculateChunkMinPosition(position);
                
                var chunk = ctx.Db.chunk.chunk_layer_pos
                    .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                    .FirstOrDefault();
                
                if (chunk != null)
                {
                    var voxels = VoxelCompression.Decompress(chunk.Voxels);
                    var localPos = new Vector3(worldX - chunkMinPos.X, worldY - chunkMinPos.Y, worldZ - chunkMinPos.Z);
                    var localIndex = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
                    voxels[localIndex] = 0;
                    chunk.Voxels = VoxelCompression.Compress(voxels);
                    ctx.Db.chunk.Id.Update(chunk);
                }
            }
        }

        ctx.Db.selections.Id.Delete(selection.Id);
    }
}
