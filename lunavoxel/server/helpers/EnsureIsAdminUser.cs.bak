using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c200ee6e9c75f2ab44490a855c1e18b8fb328744bed456025050c2caf1b6f6b4";
        var isProd = callerIdentity.ToLower() == "c200a66ecc0876a0e621dc5a47de270237aaac6d3ba3c2915f490aeabcd9c599";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}











































