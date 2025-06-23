using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void SyncUser(ReducerContext ctx, string identityHex, string email, string name)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c200999c4da8d5a73227e8fa4803a562bd41c2fcb525176d564003a554ed6581";
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

