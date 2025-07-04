using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void SyncUser(ReducerContext ctx, string identityHex, string email, string name)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c200b9d8b1ad9cc3b971168cd3ad214eddc68295d33ddb6f091798bc3c80513c";
        var isProd = callerIdentity.ToLower() == "c200cbc423731cb43c1a9185ac9df0ddc76494eef51a95999bc015ba01a8d1e5";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }

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















































