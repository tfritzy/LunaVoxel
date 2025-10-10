using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c200bd16a269146adf7e1de5bea5aee4c0496dc9452277304fba802c9803b9d8";
        var isProd = callerIdentity.ToLower() == "c200a66ecc0876a0e621dc5a47de270237aaac6d3ba3c2915f490aeabcd9c599";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}
































