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
        int z2,
        string? color
        )
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
                Mode = mode,
                BlockColor = (mode == BlockModificationMode.Erase ? null : (color ?? "#ffffff")),
                StartPos = new Vector3(x1, y1, z1),
            };
            ctx.Db.PreviewVoxels.Insert(previewVoxels);
        }
        else
        {
            if (mode != BlockModificationMode.Erase && color != null)
            {
                previewVoxels.BlockColor = color;
            }
        }

        int minX = Math.Min(x1, x2);
        int minY = Math.Min(y1, y2);
        int minZ = Math.Min(z1, z2);
        int maxX = Math.Max(x1, x2);
        int maxY = Math.Max(y1, y2);
        int maxZ = Math.Max(z1, z2);

        previewVoxels.PreviewPositions = new BlockRun[] {
            new BlockRun(type, new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ), null)
        };

        previewVoxels.Mode = mode;

        ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
    }
}