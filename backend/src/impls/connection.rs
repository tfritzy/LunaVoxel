use spacetimedb::{reducer, ReducerContext};
use crate::User;

#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    let existing_user = ctx.db.user().identity().find(&ctx.sender);
    
    if existing_user.is_none() {
        ctx.db.user().insert(User {
            identity: ctx.sender,
            email: None,
            name: None,
        });
    }
}

#[reducer(client_disconnected)]
pub fn client_disconnected(ctx: &ReducerContext) {
    let cursors_to_delete: Vec<_> = ctx.db.player_cursor()
        .player_cursor_player()
        .filter(&ctx.sender)
        .collect();
    
    for cursor in cursors_to_delete {
        ctx.db.player_cursor().id().delete(&cursor.id);
    }
}