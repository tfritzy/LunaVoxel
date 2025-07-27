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

        byte[] voxels = VoxelRLE.Decompress(layer.Voxels);

        foreach (var position in positions)
        {
            int x = position.X, y = position.Y, z = position.Z;
            if (x < 0 || x >= layer.xDim || y < 0 || y >= layer.yDim || z < 0 || z >= layer.zDim)
            {
                continue;
            }

            int index = (x * layer.yDim * layer.zDim + y * layer.zDim + z) * 2;

            switch (mode)
            {
                case BlockModificationMode.Build:
                    var buildBlock = new BlockType(blockType, rotation);
                    var buildBytes = buildBlock.ToBytes();
                    Array.Copy(buildBytes, 0, voxels, index, 2);
                    break;

                case BlockModificationMode.Erase:
                    voxels[index] = 0;
                    voxels[index + 1] = 0;
                    break;

                case BlockModificationMode.Paint:
                    var existingBytes = new byte[] { voxels[index], voxels[index + 1] };
                    var existingBlock = BlockType.FromBytes(existingBytes);
                    if (existingBlock.Type != 0)
                    {
                        var paintedBlock = new BlockType(existingBlock.Type, rotation);
                        var paintedBytes = paintedBlock.ToBytes();
                        Array.Copy(paintedBytes, 0, voxels, index, 2);
                    }
                    break;
            }
        }

        var compressedAfter = VoxelRLE.Compress(voxels);
        UndoRedo.AddEntry(ctx, projectId, layer.Id, layer.Voxels, compressedAfter);

        layer.Voxels = compressedAfter;
        ctx.Db.layer.Id.Update(layer);

    }
}