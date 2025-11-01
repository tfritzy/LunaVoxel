using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c2002a3261282d44dc1e7a71eb44c132b40ceeb4d3d6a5d51df4b4760ada57cc";
        var isProd = callerIdentity.ToLower() == "c200a66ecc0876a0e621dc5a47de270237aaac6d3ba3c2915f490aeabcd9c599";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}











































