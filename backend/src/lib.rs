use spacetimedb::{reducer, Identity, ReducerContext};

mod helpers;
mod impls;
mod types;

pub use types::*;

#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    impls::connection::handle_client_connected(ctx);
}

#[reducer(client_disconnected)]
pub fn client_disconnected(ctx: &ReducerContext) {
    impls::connection::handle_client_disconnected(ctx);
}

#[reducer]
pub fn create_project(
    ctx: &ReducerContext,
    id: String,
    name: String,
    x_dim: i32,
    y_dim: i32,
    z_dim: i32,
) {
    impls::project::create_project(ctx, id, name, x_dim, y_dim, z_dim);
}

#[reducer]
pub fn update_project_name(ctx: &ReducerContext, project_id: String, name: String) {
    impls::project::update_project_name(ctx, project_id, name);
}

#[reducer]
pub fn poke_project(ctx: &ReducerContext, project_id: String) {
    impls::project::poke_project(ctx, project_id);
}

#[reducer]
pub fn add_layer(ctx: &ReducerContext, project_id: String) {
    impls::layer::add_layer(ctx, project_id);
}

#[reducer]
pub fn delete_layer(ctx: &ReducerContext, id: String) {
    impls::layer::delete_layer(ctx, id);
}

#[reducer]
pub fn toggle_layer_visibility(ctx: &ReducerContext, layer_id: String) {
    impls::layer::toggle_layer_visibility(ctx, layer_id);
}

#[reducer]
pub fn toggle_layer_lock(ctx: &ReducerContext, layer_id: String) {
    impls::layer::toggle_layer_lock(ctx, layer_id);
}

#[reducer]
pub fn reorder_layers(ctx: &ReducerContext, project_id: String, new_order: Vec<String>) {
    impls::layer::reorder_layers(ctx, project_id, new_order);
}

#[reducer]
pub fn modify_block(
    ctx: &ReducerContext,
    project_id: String,
    diff_data: Vec<u32>,
    layer_index: i32,
) {
    impls::block::modify_block(ctx, project_id, diff_data, layer_index);
}

#[reducer]
pub fn modify_block_rect(
    ctx: &ReducerContext,
    project_id: String,
    mode: ToolType,
    block_type: u32,
    start: Vector3,
    end: Vector3,
    rotation: u32,
    layer_index: i32,
) {
    impls::block::modify_block_rect(
        ctx,
        project_id,
        mode,
        block_type,
        start,
        end,
        rotation,
        layer_index,
    );
}

#[reducer]
pub fn undo_edit(
    ctx: &ReducerContext,
    project_id: String,
    before_diff: Vec<u8>,
    after_diff: Vec<u8>,
    layer_index: i32,
) {
    impls::block::undo_edit(ctx, project_id, before_diff, after_diff, layer_index);
}

#[reducer]
pub fn initialize_blocks(ctx: &ReducerContext, project_id: String) {
    impls::block::initialize_blocks(ctx, &project_id);
}

#[reducer]
pub fn update_block(ctx: &ReducerContext, project_id: String, index: i32, face_colors: Vec<i32>) {
    impls::block::update_block(ctx, project_id, index, face_colors);
}

#[reducer]
pub fn invite_to_project(
    ctx: &ReducerContext,
    project_id: String,
    email: String,
    access_type: AccessType,
) {
    impls::access::invite_to_project(ctx, project_id, email, access_type);
}

#[reducer]
pub fn change_user_access_to_project(
    ctx: &ReducerContext,
    project_id: String,
    email: String,
    access_type: AccessType,
) {
    impls::access::change_user_access_to_project(ctx, project_id, email, access_type);
}

#[reducer]
pub fn change_public_access_to_project(
    ctx: &ReducerContext,
    project_id: String,
    access_type: AccessType,
) {
    impls::access::change_public_access_to_project(ctx, project_id, access_type);
}

#[reducer]
pub fn update_cursor_pos(
    ctx: &ReducerContext,
    project_id: String,
    identity: Identity,
    pos: Option<Vector3Float>,
    normal: Option<Vector3Float>,
) {
    impls::cursor::update_cursor_pos(ctx, project_id, identity, pos, normal);
}
