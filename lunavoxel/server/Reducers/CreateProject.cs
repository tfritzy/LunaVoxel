using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void CreateProject(ReducerContext ctx, string id, string name, int xDim, int yDim, int zDim)
    {
        var user = ctx.Db.user.Identity.Find(ctx.Sender) ?? throw new ArgumentException("User not found");
        var project = Project.Build(id, name, xDim, yDim, zDim, ctx.Sender, ctx.Timestamp);
        ctx.Db.projects.Insert(project);
        ctx.Db.user_projects.Insert(UserProject.Build(ctx.Sender, project.Id, AccessType.ReadWrite, user.Email));
        var layer = Layer.Build(project.Id, xDim, yDim, zDim, 0);
        ctx.Db.layer.Insert(layer);
        InitializeAtlas(ctx, project.Id);
    }
}
