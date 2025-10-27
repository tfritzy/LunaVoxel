use spacetimedb::{reducer, ReducerContext};
use crate::Layer;
use super::helpers::ensure_access_to_project;


pub fn add_layer(ctx: &ReducerContext, project_id: String) {
    spacetimedb::log::info!("Add layer called for {}", project_id);
    ensure_access_to_project(ctx, &project_id, &ctx.sender).expect("Access denied");
    
    let project = ctx.db.projects().id().find(&project_id)
        .expect("Project not found");
    
    let existing_layers: Vec<_> = ctx.db.layer()
        .layer_project()
        .filter(&project_id)
        .collect();
    
    let next_index = if existing_layers.is_empty() {
        0
    } else {
        existing_layers.iter().map(|l| l.index).max().unwrap() + 1
    };
    
    if next_index > 10 {
        panic!("Max of 10 layers reached");
    }
    
    let new_layer = Layer::build(
        project_id.clone(),
        project.dimensions.x,
        project.dimensions.y,
        project.dimensions.z,
        next_index,
    );
    
    ctx.db.layer().insert(new_layer);
    spacetimedb::log::info!("Added layer for {}", project_id);
}


pub fn delete_layer(ctx: &ReducerContext, id: String) {
    let layer = ctx.db.layer().id().find(&id)
        .expect("Layer not found");
    
    ensure_access_to_project(ctx, &layer.project_id, &ctx.sender).expect("Access denied");
    
    let mut layers: Vec<_> = ctx.db.layer()
        .layer_project()
        .filter(&layer.project_id)
        .collect();
    
    layers.sort_by_key(|l| l.index);
    
    ctx.db.layer().id().delete(&id);
    
    let remaining_layers: Vec<_> = layers.into_iter()
        .filter(|l| l.id != id)
        .collect();
    
    for (i, mut layer) in remaining_layers.into_iter().enumerate() {
        if layer.index != i as i32 {
            layer.index = i as i32;
            ctx.db.layer().id().update(layer);
        }
    }
}


pub fn toggle_layer_visibility(ctx: &ReducerContext, layer_id: String) {
    let mut layer = ctx.db.layer().id().find(&layer_id)
        .expect("Layer not found");
    
    ensure_access_to_project(ctx, &layer.project_id, &ctx.sender).expect("Access denied");
    
    layer.visible = !layer.visible;
    ctx.db.layer().id().update(layer);
}


pub fn toggle_layer_lock(ctx: &ReducerContext, layer_id: String) {
    let mut layer = ctx.db.layer().id().find(&layer_id)
        .expect("Layer not found");
    
    ensure_access_to_project(ctx, &layer.project_id, &ctx.sender).expect("Access denied");
    
    layer.locked = !layer.locked;
    ctx.db.layer().id().update(layer);
}


pub fn reorder_layers(ctx: &ReducerContext, project_id: String, new_order: Vec<String>) {
    ensure_access_to_project(ctx, &project_id, &ctx.sender).expect("Access denied");
    
    let layers: Vec<_> = ctx.db.layer()
        .layer_project()
        .filter(&project_id)
        .collect();
    
    if layers.is_empty() {
        return;
    }
    
    use std::collections::HashMap;
    let layer_dict: HashMap<String, Layer> = layers.into_iter()
        .map(|l| (l.id.clone(), l))
        .collect();
    
    for (i, layer_id) in new_order.iter().enumerate() {
        if let Some(mut layer) = layer_dict.get(layer_id).cloned() {
            if layer.index != i as i32 {
                layer.index = i as i32;
                ctx.db.layer().id().update(layer);
            }
        }
    }
    
    let mut unordered_layers: Vec<_> = layer_dict.into_iter()
        .filter(|(id, _)| !new_order.contains(id))
        .map(|(_, layer)| layer)
        .collect();
    
    unordered_layers.sort_by_key(|l| l.index);
    
    let mut next_index = new_order.len() as i32;
    for mut layer in unordered_layers {
        if layer.index != next_index {
            layer.index = next_index;
            ctx.db.layer().id().update(layer);
        }
        next_index += 1;
    }
}