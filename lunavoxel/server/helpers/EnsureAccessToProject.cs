using SpacetimeDB;

public static class EnsureAccessToProject
{
    public static void Check(SpacetimeDB.ReducerContext ctx, string projectId, Identity identity)
    {
        if (string.IsNullOrEmpty(projectId))
        {
            throw new ArgumentException("Project ID cannot be null or empty.");
        }

        var userProject = ctx.Db.user_projects.idx_user_project
            .Filter((projectId, identity))
            .FirstOrDefault();

        if (userProject == null)
        {
            throw new UnauthorizedAccessException($"User {identity} does not have access to project {projectId}.");
        }
    }
}