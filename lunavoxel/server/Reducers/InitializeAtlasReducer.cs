using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void InitializeAtlas(ReducerContext ctx, string projectId)
    {
        var existingAtlas = ctx.Db.atlas.ProjectId.Find(projectId);
        if (existingAtlas != null)
        {
            return;
        }

        ctx.Db.atlas.Insert(new Atlas { ProjectId = projectId, Size = 32 });
    }
}
