using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void
    ModifyBlock(
        ReducerContext ctx,
        string world,
        BlockModificationMode mode,
        MeshType type,
        List<Vector3> positions)
    {
        var player = ctx.Db.PlayerInWorld.player_world.Filter((ctx.Sender, world)).FirstOrDefault()
            ?? throw new ArgumentException("You're not in this world.");
        var palette =
            ctx.Db.ColorPalette.World.Find(world) ?? throw new ArgumentException("No color palette for world.");
        var color = GetPlayerColor(player.SelectedColor, palette);
        var previewVoxels = ctx.Db.PreviewVoxels.player_world.Filter((ctx.Sender, world)).FirstOrDefault();
        var chunk = ctx.Db.Chunk.Id.Find($"{world}_0") ?? throw new ArgumentException("No chunk for this world");

        if (previewVoxels != null)
        {
            previewVoxels.PreviewPositions = Array.Empty<BlockRun>();
            ctx.Db.PreviewVoxels.Id.Update(previewVoxels);
        }

        var decompressedBlocks = BlockCompression.Decompress(chunk.Blocks, chunk.xDim, chunk.yDim, chunk.zDim);

        foreach (var position in positions)
        {
            int x = position.X, y = position.Y, z = position.Z;
            if (x < 0 || x >= chunk.xDim || y < 0 || y >= chunk.yDim || z < 0 || z >= chunk.zDim)
            {
                continue;
            }
            switch (mode)
            {
                case BlockModificationMode.Build:
                    decompressedBlocks[x, y, z] = new Block(type, color);
                    break;
                case BlockModificationMode.Erase:
                    decompressedBlocks[x, y, z] = null;
                    break;
                case BlockModificationMode.Paint:
                    var existingBlock = decompressedBlocks[x, y, z];
                    if (existingBlock != null && existingBlock.Type != MeshType.Block)
                    {
                        decompressedBlocks[x, y, z] = new Block(existingBlock.Type, color);
                    }
                    break;
            }
        }
        chunk.Blocks = BlockCompression.Compress(decompressedBlocks).ToArray();
        ctx.Db.Chunk.Id.Update(chunk);
    }
}
