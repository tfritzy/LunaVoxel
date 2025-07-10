using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateBlock(ReducerContext ctx, string projectId, int index, int[] atlasFaceIndexes, int rotation)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var projectBlocks = ctx.Db.project_blocks.ProjectId.Find(projectId)
            ?? throw new ArgumentException("No blocks found for this project");

        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);



    }
}