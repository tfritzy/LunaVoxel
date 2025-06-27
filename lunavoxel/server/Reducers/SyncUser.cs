using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void SyncUser(ReducerContext ctx, string identityHex, string email, string name)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c2002a1b5925b250b97365db5a110b752489ba8cde458ae56acefdae646b7f03";
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


















