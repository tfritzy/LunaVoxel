using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c2001b1f72c725bdf17b5eb8eb6080109ab8748714526c52ff81e5140fb9acbe";
        var isProd = callerIdentity.ToLower() == "c200cbc423731cb43c1a9185ac9df0ddc76494eef51a95999bc015ba01a8d1e5";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}
