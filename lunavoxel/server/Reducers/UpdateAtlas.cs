using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void UpdateAtlas(ReducerContext ctx, string projectId, int index, int color, bool incrementVersion)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new System.ArgumentException("Project ID cannot be null or empty.");
        }

        var atlas = ctx.Db.atlas.ProjectId.Find(projectId)
            ?? throw new System.ArgumentException("Atlas not found for the given project ID.");

        if (index < 0 || index >= atlas.Colors.Length)
        {
            throw new System.ArgumentOutOfRangeException(nameof(index), "Index is out of range for the atlas colors.");
        }

        if (incrementVersion)
        {
            atlas.Version++;
        }

        atlas.Colors[index] = color;
        ctx.Db.atlas.ProjectId.Update(atlas);
    }
}