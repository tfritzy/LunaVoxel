using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateAtlas(
        ReducerContext ctx,
        string projectId,
        int gridSize,
        int cellPixelWidth,
        int usedSlots)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var atlas = ctx.Db.atlas.ProjectId.Find(projectId)
            ?? throw new ArgumentException("Atlas not found for the given project ID.");

        EnsureIsAdminUser.Check(ctx);

        atlas.Version++;
        atlas.CellPixelWidth = cellPixelWidth;
        atlas.GridSize = gridSize;
        atlas.UsedSlots = usedSlots;
        ctx.Db.atlas.ProjectId.Update(atlas);
    }
}