use spacetimedb::{reducer, ReducerContext};
use crate::{UserProject, AccessType};
use super::helpers::{ensure_write_access, is_valid_email};


pub fn invite_to_project(
    ctx: &ReducerContext,
    project_id: String,
    email: String,
    access_type: AccessType,
) {
    if project_id.is_empty() {
        panic!("Project ID cannot be null or empty.");
    }
    
    if email.is_empty() {
        panic!("Email cannot be null or empty.");
    }
    
    if !is_valid_email(&email) {
        panic!("Invalid email address.");
    }
    
    let user_access = ctx.db.user_projects()
        .idx_user_project()
        .filter(&(project_id.clone(), ctx.sender))
        .next();
    
    if user_access.is_none() || !matches!(user_access.as_ref().unwrap().access_type, AccessType::ReadWrite) {
        panic!("You do not have permission to invite users to this project.");
    }
    
    let existing_user_project = ctx.db.user_projects()
        .idx_project_id_email()
        .filter(&(project_id.clone(), Some(email.clone())))
        .next();
    
    if let Some(mut user_project) = existing_user_project {
        user_project.access_type = access_type;
        ctx.db.user_projects().id().update(user_project);
        return;
    }
    
    let user = ctx.db.user().email().filter(&Some(email.clone())).next();
    let user_identity = user.map(|u| u.identity).unwrap_or_else(|| spacetimedb::Identity::__dummy());
    
    let user_project = UserProject::build(
        user_identity,
        project_id,
        access_type,
        Some(email),
        None,
    );
    
    ctx.db.user_projects().insert(user_project);
}


pub fn change_user_access_to_project(
    ctx: &ReducerContext,
    project_id: String,
    email: String,
    access_type: AccessType,
) {
    if project_id.is_empty() {
        panic!("Project ID cannot be null or empty.");
    }
    
    if email.is_empty() {
        panic!("Email cannot be null or empty.");
    }
    
    let user_access = ctx.db.user_projects()
        .idx_user_project()
        .filter(&(project_id.clone(), ctx.sender))
        .next();
    
    spacetimedb::log::info!("user access: {:?}", user_access);
    
    if user_access.is_none() || !matches!(user_access.as_ref().unwrap().access_type, AccessType::ReadWrite) {
        panic!("You do not have permission to edit user access in this project.");
    }
    
    let project = ctx.db.projects().id().find(&project_id)
        .expect("Project not found");
    
    let user_project = ctx.db.user_projects()
        .idx_project_id_email()
        .filter(&(project_id.clone(), Some(email.clone())))
        .next()
        .expect("User not found in this project.");
    
    if project.owner == user_project.user {
        panic!("You cannot change access for the project owner.");
    }
    
    if matches!(access_type, AccessType::None) {
        ctx.db.user_projects().id().delete(&user_project.id);
    } else {
        let mut updated_user_project = user_project;
        updated_user_project.access_type = access_type;
        ctx.db.user_projects().id().update(updated_user_project);
    }
}


pub fn change_public_access_to_project(
    ctx: &ReducerContext,
    project_id: String,
    access_type: AccessType,
) {
    if project_id.is_empty() {
        panic!("Project ID cannot be null or empty.");
    }
    
    let user_access = ctx.db.user_projects()
        .idx_user_project()
        .filter(&(project_id.clone(), ctx.sender))
        .next();
    
    if user_access.is_none() || !matches!(user_access.as_ref().unwrap().access_type, AccessType::ReadWrite) {
        panic!("You do not have permission to edit user access in this project.");
    }
    
    let mut project = ctx.db.projects().id().find(&project_id)
        .expect("Project not found");
    
    project.public_access = access_type;
    ctx.db.projects().id().update(project);
    
    if matches!(access_type, AccessType::None) {
        let inherited_user_projects: Vec<_> = ctx.db.user_projects()
            .idx_project_id_only()
            .filter(&project_id)
            .filter(|up| matches!(up.access_type, AccessType::Inherited))
            .collect();
        
        for user_project in inherited_user_projects {
            ctx.db.user_projects().id().delete(&user_project.id);
        }
    }
}