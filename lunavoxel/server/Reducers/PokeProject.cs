using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void PokeProject(ReducerContext ctx, string projectId)
    {
        ctx.Db.test_user_projects.Insert(new TestUserProject { Id = IdGenerator.Generate("smthn"), User = ctx.Sender });

        var project = ctx.Db.projects.Id.Find(projectId);
        if (project == null)
        {
            Log.Info($"User {ctx.Sender} tried poking {projectId} but it doesn't exist");
            return;
        }

        if (project.PublicAccess != AccessType.Read && project.PublicAccess != AccessType.ReadWrite)
        {
            Log.Info($"User {ctx.Sender} tried poking {project.Id} but its public access type is {project.PublicAccess}");
            return;
        }

        UpdateCursorPos(ctx, projectId, ctx.Sender, null, null);

        var existingUserProject = ctx.Db.user_projects.idx_user_project.Filter((projectId, ctx.Sender)).FirstOrDefault();
        if (existingUserProject != null)
        {
            Log.Info($"User {ctx.Sender} already has access to the project of {existingUserProject.AccessType}");
            return;
        }

        var user = ctx.Db.user.Identity.Find(ctx.Sender);
        if (user == null)
        {
            Log.Info($"Could not find an identity {user}");
            return;
        }

        ctx.Db.user_projects.Insert(UserProject.Build(ctx.Sender, projectId, AccessType.Inherited, user.Email));
    }
}