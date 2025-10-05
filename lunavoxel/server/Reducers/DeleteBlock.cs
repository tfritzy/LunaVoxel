using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void DeleteBlock(
        ReducerContext ctx,
        string projectId,
        int blockIndex,
        uint replacementBlockType)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var projectBlocks = ctx.Db.project_blocks.ProjectId.Find(projectId)
            ?? throw new ArgumentException("No blocks found for this project");

        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        if (blockIndex < 0 || blockIndex > projectBlocks.FaceColors.Length)
        {
            throw new ArgumentOutOfRangeException(nameof(blockIndex), "Block index is out of range.");
        }

        var updatedFaceColors = new int[projectBlocks.FaceColors.Length - 1][];
        int writeIndex = 0;
        for (int i = 0; i < projectBlocks.FaceColors.Length; i++)
        {
            if (i != blockIndex - 1)
            {
                updatedFaceColors[writeIndex] = projectBlocks.FaceColors[i];
                writeIndex++;
            }
        }

        projectBlocks.FaceColors = updatedFaceColors;
        ctx.Db.project_blocks.ProjectId.Update(projectBlocks);

        if (replacementBlockType > blockIndex)
        {
            replacementBlockType -= 1;
        }

        var layers = ctx.Db.layer.layer_project.Filter(projectId).ToList();
        foreach (var layer in layers)
        {
            if (layer.Locked) continue;

            uint[] voxels = VoxelCompression.Decompress(layer.Voxels);
            bool layerModified = false;

            for (int i = 0; i < voxels.Length; i++)
            {
                var blockType = VoxelDataUtils.GetBlockType(voxels[i]);

                if (blockType == blockIndex)
                {
                    var rotation = VoxelDataUtils.GetRotation(voxels[i]);
                    var version = VoxelDataUtils.GetVersion(voxels[i]);
                    voxels[i] = VoxelDataUtils.EncodeBlockData(replacementBlockType, rotation, version);
                    layerModified = true;
                }
                else if (blockType > blockIndex)
                {
                    var rotation = VoxelDataUtils.GetRotation(voxels[i]);
                    var version = VoxelDataUtils.GetVersion(voxels[i]);
                    voxels[i] = VoxelDataUtils.EncodeBlockData(blockType - 1, rotation, version);
                    layerModified = true;
                }
            }

            if (layerModified)
            {
                layer.Voxels = VoxelCompression.Compress(voxels);
                ctx.Db.layer.Id.Update(layer);
            }
        }
    }
}