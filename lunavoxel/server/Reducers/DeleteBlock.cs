using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void DeleteBlock(
        ReducerContext ctx,
        string projectId,
        int blockIndex,
        byte replacementBlockType)
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

        var allChunks = ctx.Db.chunk.chunk_project.Filter(projectId);
        foreach (var chunk in allChunks)
        {
            var voxels = VoxelCompression.Decompress(chunk.Voxels);
            bool chunkModified = false;

            for (int i = 0; i < voxels.Length; i++)
            {
                byte voxelValue = voxels[i];
                
                if (voxelValue == blockIndex)
                {
                    voxels[i] = replacementBlockType;
                    chunkModified = true;
                }
                else if (voxelValue > blockIndex)
                {
                    voxels[i] = (byte)(voxelValue - 1);
                    chunkModified = true;
                }
            }

            if (chunkModified)
            {
                chunk.Voxels = VoxelCompression.Compress(voxels);
                ctx.Db.chunk.Id.Update(chunk);
            }
        }
    }
}