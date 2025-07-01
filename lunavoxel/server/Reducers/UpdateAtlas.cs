using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateAtlas(
        ReducerContext ctx,
        string projectId,
        int newSize,
        bool incrementVersion,
        int cellSize)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new System.ArgumentException("Project ID cannot be null or empty.");
        }

        var atlas = ctx.Db.atlas.ProjectId.Find(projectId)
            ?? throw new System.ArgumentException("Atlas not found for the given project ID.");

        if (incrementVersion)
        {
            atlas.Version++;
        }

        if (atlas.CellSize > 0 && cellSize != atlas.CellSize)
        {
            throw new System.ArgumentException("Cell size cannot be changed once set.");
        }

        atlas.CellSize = cellSize;
        atlas.Size = newSize;
        ctx.Db.atlas.ProjectId.Update(atlas);
    }
}