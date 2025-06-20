
using SpacetimeDB;

public static partial class Module
{
    [Reducer(ReducerKind.ClientConnected)]
    public static void ClientConnected(ReducerContext ctx)
    {
        var existingUser = ctx.Db.user.Identity.Find(ctx.Sender);
        if (existingUser == null)
        {
            ctx.Db.user.Insert(new User
            {
                Identity = ctx.Sender,
                Email = null
            });
        }
    }


    [Reducer(ReducerKind.ClientDisconnected)]
    public static void ClientDisconnected(ReducerContext ctx)
    {
    }
}