using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void ModifyBlock(
        ReducerContext ctx,
        string projectId,
        BlockModificationMode mode,
        int blockType,
        uint[] diffData,
        int rotation,
        int layerIndex)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        if (layer.Locked) return;

        uint[] voxels = VoxelRLE.Decompress(layer.Voxels);

        for (int i = 0; i < diffData.Length; i++)
        {
            if (diffData[i] > 0) // full 0 in diff means no op.
            {
                var newVoxel = BlockType.FromInt(diffData[i]);
                switch (mode)
                {
                    case BlockModificationMode.Build:
                        voxels[i] = newVoxel.ToInt();
                        break;

                    case BlockModificationMode.Erase:
                        voxels[i] = VoxelDataUtils.EncodeBlockData(0, 0, newVoxel.Version);
                        break;

                    case BlockModificationMode.Paint:
                        var existingType = VoxelDataUtils.GetBlockType(voxels[i]);
                        if (existingType != 0)
                        {
                            voxels[i] = newVoxel.ToInt();
                        }
                        break;
                }
            }
        }

        layer.Voxels = VoxelRLE.Compress(voxels);
        ctx.Db.layer.Id.Update(layer);

        var project = ctx.Db.projects.Id.Find(projectId) ?? throw new ArgumentException("No such project");
        if (ctx.Sender == project.Owner)
        {
            // Updated is used to find the most recent project of the user, so don't care about shared updates.
            project.Updated = ctx.Timestamp;
            ctx.Db.projects.Id.Update(project);
        }
    }
}