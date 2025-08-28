using System;
using System.Collections.Generic;
using SpacetimeDB;
public static partial class Module
{
    [Reducer]
    public static void ModifyBlockAmorphous(
        ReducerContext ctx,
        string projectId,
        byte[] compressedDiffData,
        int layerIndex)
    {
        var layer = ctx.Db.layer.project_index.Filter((projectId, layerIndex)).FirstOrDefault()
             ?? throw new ArgumentException("No layer for this project");
        var diffData = VoxelCompression.Decompress(compressedDiffData);
        ModifyBlock(ctx, projectId, diffData, layerIndex);
    }
}