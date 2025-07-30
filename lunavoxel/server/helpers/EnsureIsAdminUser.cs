using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c200d73d98c68494e3f2c47c3a1978af8bf17096ddc721948328750f6968c067";
        var isProd = callerIdentity.ToLower() == "c200cbc423731cb43c1a9185ac9df0ddc76494eef51a95999bc015ba01a8d1e5";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}
