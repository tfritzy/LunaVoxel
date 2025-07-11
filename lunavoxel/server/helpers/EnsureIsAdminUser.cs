using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c2009eae27051869f4e76bed39cae96de8316f9c0786f52ae54372ba5f9c0d93";
        var isProd = callerIdentity.ToLower() == "c200cbc423731cb43c1a9185ac9df0ddc76494eef51a95999bc015ba01a8d1e5";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}












