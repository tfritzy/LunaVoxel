using SpacetimeDB;

public static partial class Module
{
    [Reducer]
    public static void SyncUser(ReducerContext ctx, string email)
    {
        var user = ctx.Db.user.Identity.Find(ctx.Sender);
        if (user != null)
        {
            user.Email = email;
            ctx.Db.user.Identity.Update(user);
        }
        else
        {
            ctx.Db.user.Insert(new User() { Identity = ctx.Sender, Email = email });
        }
    }
}
