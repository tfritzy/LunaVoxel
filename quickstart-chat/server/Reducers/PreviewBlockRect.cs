using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void PreviewBlockRect(
        ReducerContext ctx,
        string world,
        BlockModificationMode mode,
        MeshType type,
        int x1,
        int y1,
        int z1,
        int x2,
        int y2,
        int z2)
    {
        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();

        if (previewVoxels == null)
        {
            previewVoxels = new PreviewVoxels
            {
                Id = IdGenerator.Generate("prvw"),
                Player = ctx.Sender,
                World = world,
                PreviewPositions = Array.Empty<BlockRun>(),
                IsAddMode = mode != BlockModificationMode.Erase,
                BlockColor = mode == BlockModificationMode.Erase ? null : "#ffffff",
                StartPos = new Vector3(x1, y1, z1),
            };
            ctx.Db.PreviewVoxels.Insert(previewVoxels);
        }

        Block[,,] blocks = new Block[x2 - x1, y2 - y1, z2 - z1];
        for (int x = x1; x <= x2; x++)
        {
            for (int y = y1; y <= y2; y++)
            {
                for (int z = z1; z <= z2; z++)
                {
                    blocks[x, y, z] = new Block(type);
                }
            }
        }

        previewVoxels.PreviewPositions = [.. BlockCompression.Compress(blocks)];
        previewVoxels.BlockColor = mode == BlockModificationMode.Erase ? null : "#ffffff";
        previewVoxels.IsAddMode = mode != BlockModificationMode.Erase;
        ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
    }
}