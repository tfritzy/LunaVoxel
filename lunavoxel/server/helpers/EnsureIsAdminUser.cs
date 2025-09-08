using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c20036867d6da53ef81ec33d2ef9f1d35d415c8cf0ad03eaf81f4ee8a3df8145";
        var isProd = callerIdentity.ToLower() == "c200a66ecc0876a0e621dc5a47de270237aaac6d3ba3c2915f490aeabcd9c599";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}





















