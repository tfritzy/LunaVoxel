using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateAtlas(
        ReducerContext ctx,
        string projectId,
        int newSize,
        int cellSize)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var atlas = ctx.Db.atlas.ProjectId.Find(projectId)
            ?? throw new ArgumentException("Atlas not found for the given project ID.");

        atlas.Version++;
        atlas.CellSize = cellSize;
        atlas.Size = newSize;
        ctx.Db.atlas.ProjectId.Update(atlas);
    }
}