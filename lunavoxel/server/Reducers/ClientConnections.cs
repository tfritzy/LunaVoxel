
using SpacetimeDB;

public static partial class Module
{
    [Reducer(ReducerKind.ClientConnected)]
    public static void ClientConnected(ReducerContext ctx)
    {
        var existingUser = ctx.Db.user.Identity.Find(ctx.Sender);
        string? email = null;
        
        // Read email from issuer claims (SpacetimeDB 1.7.0+)
        // AuthCtx provides access to authentication context including issuer claims
        if (ctx.AuthCtx?.Issuer?.Claims != null)
        {
            ctx.AuthCtx.Issuer.Claims.TryGetValue("email", out email);
        }
        
        if (existingUser == null)
        {
            ctx.Db.user.Insert(new User
            {
                Identity = ctx.Sender,
                Email = email
            });
        }
        else if (email != existingUser.Email)
        {
            existingUser.Email = email;
            ctx.Db.user.Identity.Update(existingUser);
        }
    }


    [Reducer(ReducerKind.ClientDisconnected)]
    public static void ClientDisconnected(ReducerContext ctx)
    {
        var cursorsToDelete = ctx.Db.player_cursor.player_cursor_player.Filter(ctx.Sender);
        foreach (var cursor in cursorsToDelete)
        {
            ctx.Db.player_cursor.Id.Delete(cursor.Id);
        }
    }
}