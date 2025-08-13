using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void PokeProject(ReducerContext ctx, string projectId)
    {
        var project = ctx.Db.projects.Id.Find(projectId);
        if (project == null)
        {
            return;
        }

        if (project.PublicAccess != AccessType.Read && project.PublicAccess != AccessType.ReadWrite)
        {
            return;
        }

        var existingUserProject = ctx.Db.user_projects.idx_user_project.Filter((projectId, ctx.Sender)).FirstOrDefault();
        if (existingUserProject != null)
        {
            return;
        }

        var user = ctx.Db.user.Identity.Find(ctx.Sender);
        if (user == null)
        {
            return;
        }

        ctx.Db.user_projects.Insert(UserProject.Build(ctx.Sender, projectId, AccessType.Inherited, user.Email));
        UpdateCursorPos(ctx, projectId, ctx.Sender, null, null);
    }
}