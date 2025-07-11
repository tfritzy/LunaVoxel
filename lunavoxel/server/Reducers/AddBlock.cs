using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void AddBlock(
        ReducerContext ctx,
        string projectId,
        int[] atlasFaceIndexes)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var projectBlocks = ctx.Db.project_blocks.ProjectId.Find(projectId)
            ?? throw new ArgumentException("No blocks found for this project");

        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        if (atlasFaceIndexes == null || atlasFaceIndexes.Length != 6)
        {
            throw new ArgumentException("Atlas face indexes must be an array of length 6.");
        }

        projectBlocks.BlockFaceAtlasIndexes = projectBlocks.BlockFaceAtlasIndexes.Append(atlasFaceIndexes).ToArray();
        ctx.Db.project_blocks.ProjectId.Update(projectBlocks);
    }
}