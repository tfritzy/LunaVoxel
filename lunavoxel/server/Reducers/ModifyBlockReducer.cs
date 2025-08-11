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
        List<Vector3> positions,
        int rotation,
        int layerIndex)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
            ?? throw new ArgumentException("No layer for this project");

        if (layer.Locked) return;

        short[] voxels = VoxelRLE.Decompress(layer.Voxels);

        foreach (var position in positions)
        {
            int x = position.X, y = position.Y, z = position.Z;
            if (x < 0 || x >= layer.xDim || y < 0 || y >= layer.yDim || z < 0 || z >= layer.zDim)
            {
                continue;
            }

            int index = x * layer.yDim * layer.zDim + y * layer.zDim + z;

            switch (mode)
            {
                case BlockModificationMode.Build:
                    var buildBlock = new BlockType(blockType, rotation);
                    voxels[index] = buildBlock.ToShort();
                    break;

                case BlockModificationMode.Erase:
                    voxels[index] = 0;
                    break;

                case BlockModificationMode.Paint:
                    var existingBlock = BlockType.FromShort(voxels[index]);
                    if (existingBlock.Type != 0)
                    {
                        var paintedBlock = new BlockType(blockType, rotation);
                        voxels[index] = paintedBlock.ToShort();
                    }
                    break;
            }
        }

        var compressedAfter = VoxelRLE.Compress(voxels);
        UndoRedo.AddEntry(ctx, projectId, layer.Id, layer.Voxels, compressedAfter);

        layer.Voxels = compressedAfter;
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