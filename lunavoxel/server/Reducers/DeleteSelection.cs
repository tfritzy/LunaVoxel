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

        for (int x = 0; x < layer.xDim; x++)
        {
            for (int y = 0; y < layer.yDim; y++)
            {
                for (int z = 0; z < layer.zDim; z++)
                {
                    int worldIndex = x * layer.yDim * layer.zDim + y * layer.zDim + z;
                    if (selectionData[worldIndex] != 0)
                    {
                        var position = new Vector3(x, y, z);
                        var chunkMinPos = CalculateChunkMinPosition(position);
                        
                        var chunk = ctx.Db.chunk.chunk_layer_pos
                            .Filter((layer.Id, chunkMinPos.X, chunkMinPos.Y, chunkMinPos.Z))
                            .FirstOrDefault();
                        
                        if (chunk != null)
                        {
                            var voxels = VoxelCompression.Decompress(chunk.Voxels);
                            var localPos = new Vector3(x - chunkMinPos.X, y - chunkMinPos.Y, z - chunkMinPos.Z);
                            var localIndex = CalculateVoxelIndex(localPos, chunk.SizeY, chunk.SizeZ);
                            voxels[localIndex] = 0;
                            chunk.Voxels = VoxelCompression.Compress(voxels);
                            ctx.Db.chunk.Id.Update(chunk);
                            
                            // TODO find way to clean up empty chunks
                        }
                    }
                }
            }
        }

        ctx.Db.selections.Id.Delete(selection.Id);
    }
}
