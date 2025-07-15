using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void DeleteAtlasIndex(
        ReducerContext ctx,
        string projectId,
        int index,
        int gridSize,
        int cellPixelWidth,
        int usedSlots)
    {
        var atlas = ctx.Db.atlas.ProjectId.Find(projectId)
            ?? throw new ArgumentException("Atlas not found for the given project ID.");

        EnsureIsAdminUser.Check(ctx);

        var blocks = ctx.Db.project_blocks.ProjectId.Find(projectId)
            ?? throw new ArgumentException("Project blocks not found for the given project ID.");

        for (int i = 0; i < blocks.BlockFaceAtlasIndexes.Length; i++)
        {
            for (int j = 0; j < blocks.BlockFaceAtlasIndexes[i].Length; j++)
            {
                int currentIndex = blocks.BlockFaceAtlasIndexes[i][j];
                if (currentIndex >= index)
                {
                    blocks.BlockFaceAtlasIndexes[i][j] = Math.Max(0, currentIndex - 1);
                }
            }
        }

        ctx.Db.project_blocks.ProjectId.Update(blocks);

        UpdateAtlas(
            ctx,
            projectId,
            gridSize,
            cellPixelWidth,
            usedSlots);
    }
}