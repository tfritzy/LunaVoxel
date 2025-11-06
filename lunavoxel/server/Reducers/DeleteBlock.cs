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
    }
}