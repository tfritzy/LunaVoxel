use spacetimedb::{ReducerContext, Identity};
use crate::{UserProject, AccessType};

pub fn ensure_access_to_project(ctx: &ReducerContext, project_id: &str, identity: &Identity) -> Result<(), String> {
    if project_id.is_empty() {
        return Err("Project ID cannot be null or empty.".to_string());
    }

    let user_project = ctx.db.user_projects()
        .idx_user_project()
        .filter(&(project_id.to_string(), *identity))
        .next();

    if user_project.is_none() {
        return Err(format!("User {} does not have access to project {}", identity.to_hex(), project_id));
    }

    Ok(())
}

pub fn ensure_write_access(ctx: &ReducerContext, project_id: &str, identity: &Identity) -> Result<(), String> {
    if project_id.is_empty() {
        return Err("Project ID cannot be null or empty.".to_string());
    }

    let user_project = ctx.db.user_projects()
        .idx_user_project()
        .filter(&(project_id.to_string(), *identity))
        .next();

    match user_project {
        Some(up) if matches!(up.access_type, AccessType::ReadWrite) => Ok(()),
        Some(_) => Err("You do not have write access to this project.".to_string()),
        None => Err(format!("User {} does not have access to project {}", identity.to_hex(), project_id)),
    }
}

pub fn is_valid_email(email: &str) -> bool {
    let email_regex = regex::Regex::new(r"^[\w\-\.]+@([\w\-]+\.)+[\w\-]{2,4}$").unwrap();
    email_regex.is_match(email)
}