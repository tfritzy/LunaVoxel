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
        int rotation)
    {
        var chunk = ctx.Db.chunk.Id.Find($"{projectId}_0") ?? throw new ArgumentException("No chunk for this project");
        byte[] voxels = VoxelRLE.Decompress(chunk.Voxels);

        foreach (var position in positions)
        {
            int x = position.X, y = position.Y, z = position.Z;
            if (x < 0 || x >= chunk.xDim || y < 0 || y >= chunk.yDim || z < 0 || z >= chunk.zDim)
            {
                continue;
            }

            int index = (x * chunk.yDim * chunk.zDim + y * chunk.zDim + z) * 2;

            switch (mode)
            {
                case BlockModificationMode.Build:
                    var buildBlock = new Block(blockType, rotation);
                    var buildBytes = buildBlock.ToBytes();
                    Array.Copy(buildBytes, 0, voxels, index, 2);
                    break;

                case BlockModificationMode.Erase:
                    voxels[index] = 0;
                    voxels[index + 1] = 0;
                    break;

                case BlockModificationMode.Paint:
                    var existingBytes = new byte[] { voxels[index], voxels[index + 1] };
                    var existingBlock = Block.FromBytes(existingBytes);
                    if (existingBlock.Type != 0)
                    {
                        var paintedBlock = new Block(existingBlock.Type, rotation);
                        var paintedBytes = paintedBlock.ToBytes();
                        Array.Copy(paintedBytes, 0, voxels, index, 2);
                    }
                    break;
            }
        }

        chunk.Voxels = VoxelRLE.Compress(voxels);
        ctx.Db.chunk.Id.Update(chunk);
    }
}