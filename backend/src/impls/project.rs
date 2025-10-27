use spacetimedb::{reducer, ReducerContext};
use crate::{Project, UserProject, AccessType, Layer};
use super::helpers::{ensure_access_to_project, ensure_write_access};
use super::block_reducers::initialize_blocks;

pub fn create_project(ctx: &ReducerContext, id: String, name: String, x_dim: i32, y_dim: i32, z_dim: i32) {
    let user = ctx.db.user().identity().find(&ctx.sender)
        .expect("User not found");
    
    let project = Project::build(id.clone(), name, x_dim, y_dim, z_dim, ctx.sender, ctx.timestamp);
    ctx.db.projects().insert(project);
    
    let user_project = UserProject::build(
        ctx.sender,
        id.clone(),
        AccessType::ReadWrite,
        user.email.clone(),
        None,
    );
    ctx.db.user_projects().insert(user_project);
    
    let layer = Layer::build(id.clone(), x_dim, y_dim, z_dim, 0);
    ctx.db.layer().insert(layer);
    
    initialize_blocks(ctx, &id);
}

pub fn update_project_name(ctx: &ReducerContext, project_id: String, name: String) {
    if project_id.is_empty() {
        panic!("Project ID cannot be null or empty");
    }
    
    if name.is_empty() {
        panic!("Project name cannot be null or empty");
    }
    
    let name = name.trim().to_string();
    
    if name.len() > 100 {
        panic!("Project name cannot exceed 100 characters");
    }
    
    if name.len() < 1 {
        panic!("Project name must be at least 1 character long");
    }
    
    let mut project = ctx.db.projects().id().find(&project_id)
        .expect(&format!("Project with ID {} not found", project_id));
    
    if project.owner != ctx.sender {
        panic!("Only the project owner can update the project name");
    }
    
    project.name = name;
    ctx.db.projects().id().update(project);
}

pub fn poke_project(ctx: &ReducerContext, project_id: String) {
    let project = ctx.db.projects().id().find(&project_id);
    
    if project.is_none() {
        spacetimedb::log::info!("User {} tried poking {} but it doesn't exist", ctx.sender.to_hex(), project_id);
        return;
    }
    
    let project = project.unwrap();
    
    if !matches!(project.public_access, AccessType::Read | AccessType::ReadWrite) {
        spacetimedb::log::info!("User {} tried poking {} but its public access type is {:?}", ctx.sender.to_hex(), project.id, project.public_access);
        return;
    }
    
    super::cursor_reducers::update_cursor_pos(ctx, project_id.clone(), ctx.sender, None, None);
    
    let existing_user_project = ctx.db.user_projects()
        .idx_user_project()
        .filter(&(project_id.clone(), ctx.sender))
        .next();
    
    if existing_user_project.is_some() {
        spacetimedb::log::info!("User {} already has access to the project", ctx.sender.to_hex());
        return;
    }
    
    let user = ctx.db.user().identity().find(&ctx.sender);
    if user.is_none() {
        spacetimedb::log::info!("Could not find an identity {:?}", ctx.sender);
        return;
    }
    
    let user = user.unwrap();
    let user_project = UserProject::build(
        ctx.sender,
        project_id,
        AccessType::Inherited,
        user.email.clone(),
        None,
    );
    ctx.db.user_projects().insert(user_project);
}