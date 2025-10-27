use spacetimedb::{reducer, ReducerContext, Identity, Table};
use crate::{PlayerCursor, Vector3Float};
use crate::helpers::{IdGenerator, RandomNameGenerator};
use crate::types::{player_cursor, user};

pub fn update_cursor_pos(
    ctx: &ReducerContext,
    project_id: String,
    identity: Identity,
    pos: Option<Vector3Float>,
    normal: Option<Vector3Float>,
) {
    if project_id.is_empty() {
        panic!("Project ID cannot be null or empty.");
    }
    
    let existing_cursor = ctx.db.player_cursor()
        .player_cursor_project_player()
        .filter((&project_id, &identity))
        .next();
    
    if let Some(mut cursor) = existing_cursor {
        cursor.position = pos;
        cursor.normal = normal;
        cursor.last_updated = ctx.timestamp;
        
        if cursor.display_name.is_empty() {
            let player = ctx.db.user().identity().find(&identity);
            cursor.display_name = if let Some(user) = player {
                user.email.unwrap_or_else(|| RandomNameGenerator::generate(ctx.timestamp.to_micros_since_unix_epoch() as u64))
            } else {
                RandomNameGenerator::generate(ctx.timestamp.to_micros_since_unix_epoch() as u64)
            };
        }
        
        ctx.db.player_cursor().id().update(cursor);
    } else {
        let player = ctx.db.user().identity().find(&identity);
        let display_name = if let Some(user) = player {
            user.email.unwrap_or_else(|| RandomNameGenerator::generate(ctx.timestamp.to_micros_since_unix_epoch() as u64))
        } else {
            RandomNameGenerator::generate(ctx.timestamp.to_micros_since_unix_epoch() as u64)
        };
        
        let cursor = PlayerCursor {
            id: IdGenerator::generate("csr", ctx.timestamp),
            project_id,
            display_name,
            player: identity,
            position: pos,
            normal,
            last_updated: ctx.timestamp,
            tool_type: None,
        };
        
        ctx.db.player_cursor().insert(cursor);
    }
}


pub fn update_cursor_pos_reducer(
    ctx: &ReducerContext,
    project_id: String,
    identity: Identity,
    pos: Option<Vector3Float>,
    normal: Option<Vector3Float>,
) {
    update_cursor_pos(ctx, project_id, identity, pos, normal);
}