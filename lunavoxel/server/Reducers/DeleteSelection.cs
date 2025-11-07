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

        var voxelData = VoxelCompression.Decompress(selection.VoxelData);
        
        // Calculate dimensions from bounds (MaxPos is exclusive, like array indices)
        // e.g., MinPos=(0,0,0) and MaxPos=(5,5,5) means dimensions are 5x5x5
        var dimensions = new Vector3(
            selection.MaxPos.X - selection.MinPos.X,
            selection.MaxPos.Y - selection.MinPos.Y,
            selection.MaxPos.Z - selection.MinPos.Z
        );

        for (int x = 0; x < dimensions.X; x++)
        {
            for (int y = 0; y < dimensions.Y; y++)
            {
                for (int z = 0; z < dimensions.Z; z++)
                {
                    int localIndex = x * dimensions.Y * dimensions.Z + y * dimensions.Z + z;
                    if (voxelData[localIndex] != 0)
                    {
                        var worldX = selection.MinPos.X + x;
                        var worldY = selection.MinPos.Y + y;
                        var worldZ = selection.MinPos.Z + z;
                        var position = new Vector3(worldX, worldY, worldZ);
                        var chunkMinPos = CalculateChunkMinPosition(position);
                        
                        var chunk = ctx.Db.chunk.chunk_layer_pos
                            .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                            .FirstOrDefault();
                        
                        if (chunk != null)
                        {
                            var voxels = VoxelCompression.Decompress(chunk.Voxels);
                            var localPos = new Vector3(worldX - chunkMinPos.X, worldY - chunkMinPos.Y, worldZ - chunkMinPos.Z);
                            var chunkLocalIndex = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
                            voxels[chunkLocalIndex] = 0;
                            chunk.Voxels = VoxelCompression.Compress(voxels);
                            ctx.Db.chunk.Id.Update(chunk);
                        }
                    }
                }
            }
        }

        ctx.Db.selections.Id.Delete(selection.Id);
    }
}
