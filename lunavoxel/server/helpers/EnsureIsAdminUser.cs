using SpacetimeDB;

public static class EnsureIsAdminUser
{
    public static void Check(SpacetimeDB.ReducerContext ctx)
    {
        var callerIdentity = ctx.Sender.ToString();
        var isDev = callerIdentity.ToLower() == "c200e693e5a64e08b844bf3c75a87904ac2a012c85b7ba19d194f35f6c5691e7";
        var isProd = callerIdentity.ToLower() == "c200a66ecc0876a0e621dc5a47de270237aaac6d3ba3c2915f490aeabcd9c599";

        if (!isDev && !isProd)
        {
            Log.Error("Unauthorized user trying to sync user data: " + callerIdentity);
            throw new UnauthorizedAccessException("Unauthorized user");
        }
    }
}
























