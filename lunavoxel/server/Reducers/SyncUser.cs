using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void SyncUser(ReducerContext ctx, string identityHex, string email, string name)
    {
        EnsureIsAdminUser.Check(ctx);

        var identity = Identity.FromHexString(identityHex);
        var user = ctx.Db.user.Identity.Find(identity);
        if (user != null)
        {
            user.Email = email;
            user.Name = name;
            ctx.Db.user.Identity.Update(user);
        }
        else
        {
            ctx.Db.user.Insert(new User() { Identity = identity, Email = email, Name = name });
        }

        var unpopulatedUserProjects = ctx.Db.user_projects.idx_user_email.Filter((new Identity(), email)).ToList();
        foreach (var userProject in unpopulatedUserProjects)
        {
            userProject.User = identity;
            ctx.Db.user_projects.Id.Update(userProject);
        }
    }
}































































