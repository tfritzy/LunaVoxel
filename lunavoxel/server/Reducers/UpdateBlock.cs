using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateBlock(
        ReducerContext ctx,
        string projectId,
        int index,
        int[] faceColors)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var projectBlocks = ctx.Db.project_blocks.ProjectId.Find(projectId)
            ?? throw new ArgumentException("No blocks found for this project");

        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        if (index < 0 || index >= projectBlocks.FaceColors.Length)
        {
            throw new ArgumentOutOfRangeException(nameof(index), "Block index is out of range.");
        }

        if (faceColors == null || faceColors.Length != 6)
        {
            throw new ArgumentException("Atlas face indexes must be an array of length 6.");
        }

        projectBlocks.FaceColors[index] = faceColors;
        ctx.Db.project_blocks.ProjectId.Update(projectBlocks);
    }
}