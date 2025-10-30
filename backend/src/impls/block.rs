use super::helpers::ensure_access_to_project;
use crate::types::{layer, project_blocks, projects};
use crate::{ProjectBlocks, ToolType, Vector3};
use spacetimedb::{reducer, ReducerContext, Table};
use voxel_compression::VoxelCompression;

const DEFAULT_COLOR_PALETTE: [i32; 64] = [
    0xfdcbb0, 0xfca790, 0xf68181, 0xf04f78, 0xc32454, 0x831c5d, 0xed8099, 0xcf657f, 0xa24b6f,
    0x753c54, 0xeaaded, 0xa884f3, 0x905ea9, 0x6b3e75, 0x45293f, 0x8fd3ff, 0x4d9be6, 0x4d65b4,
    0x484a77, 0x323353, 0x8ff8e2, 0x30e1b9, 0x0eaf9b, 0x0b8a8f, 0x0b5e65, 0xb2ba90, 0x92a984,
    0x547e64, 0x374e4a, 0x313638, 0xcddf6c, 0x91db69, 0x1ebc73, 0x239063, 0x165a4c, 0xfbff86,
    0xd5e04b, 0xa2a947, 0x676633, 0x4c3e24, 0xfbb954, 0xe6904e, 0xcd683d, 0x9e4539, 0x7a3045,
    0xf9c22b, 0xf79617, 0xfb6b1d, 0xe83b3b, 0xae2334, 0xf57d4a, 0xea4f36, 0xb33831, 0x6e2727,
    0xffffff, 0xc7dcd0, 0x9babb2, 0x7f708a, 0x694f62, 0xab947a, 0x966c6c, 0x625565, 0x3e3546,
    0x2e222f,
];

pub fn initialize_blocks(ctx: &ReducerContext, project_id: &str) {
    ensure_access_to_project(ctx, project_id, &ctx.sender).expect("Access denied");

    let mut face_colors = Vec::with_capacity(DEFAULT_COLOR_PALETTE.len());
    for color in &DEFAULT_COLOR_PALETTE {
        face_colors.push(vec![*color; 6]);
    }

    let blocks = ProjectBlocks {
        project_id: project_id.to_string(),
        face_colors,
    };

    ctx.db.project_blocks().insert(blocks);
}

pub fn modify_block(
    ctx: &ReducerContext,
    project_id: String,
    diff_data: Vec<u8>,
    layer_index: i32,
) {
    ensure_access_to_project(ctx, &project_id, &ctx.sender).expect("Access denied");

    let mut layer = ctx
        .db
        .layer()
        .project_index()
        .filter((&project_id, &layer_index))
        .next()
        .expect("No layer for this project");

    if layer.locked {
        return;
    }

    let mut voxels = VoxelCompression::decompress(&layer.voxels);

    for (i, &diff) in diff_data.iter().enumerate() {
        if diff != 0 {
            voxels[i] = diff;
        }
    }

    layer.voxels = VoxelCompression::compress(&voxels);
    ctx.db.layer().id().update(layer);

    let mut project = ctx
        .db
        .projects()
        .id()
        .find(&project_id)
        .expect("No such project");

    if ctx.sender == project.owner {
        project.updated = ctx.timestamp;
        ctx.db.projects().id().update(project);
    }
}

fn clamp(value: i32, max: i32) -> i32 {
    value.max(0).min(max - 1)
}

pub fn modify_block_rect(
    ctx: &ReducerContext,
    project_id: String,
    mode: ToolType,
    block_type: u8,
    start: Vector3,
    end: Vector3,
    layer_index: i32,
) {
    let layer = ctx
        .db
        .layer()
        .project_index()
        .filter((&project_id, &layer_index))
        .next()
        .expect("No layer for this project");

    let mut diff_data = vec![0u8; (layer.x_dim * layer.y_dim * layer.z_dim) as usize];
    let existing_data = VoxelCompression::decompress(&layer.voxels);

    let sx = clamp(start.x, layer.x_dim);
    let sy = clamp(start.y, layer.y_dim);
    let sz = clamp(start.z, layer.z_dim);

    let ex = clamp(end.x, layer.x_dim);
    let ey = clamp(end.y, layer.y_dim);
    let ez = clamp(end.z, layer.z_dim);

    let min_x = sx.min(ex);
    let max_x = sx.max(ex);
    let min_y = sy.min(ey);
    let max_y = sy.max(ey);
    let min_z = sz.min(ez);
    let max_z = sz.max(ez);

    for x in min_x..=max_x {
        for y in min_y..=max_y {
            for z in min_z..=max_z {
                let index = (x * layer.y_dim * layer.z_dim + y * layer.z_dim + z) as usize;

                let new_value = match mode {
                    ToolType::Build => Some(block_type),
                    ToolType::Erase => Some(0u8),
                    ToolType::Paint if existing_data[index] > 0 => Some(block_type),
                    _ => None,
                };

                if let Some(val) = new_value {
                    diff_data[index] = val;
                }
            }
        }
    }

    modify_block(ctx, project_id, diff_data, layer_index);
}

pub fn undo_edit(
    ctx: &ReducerContext,
    project_id: String,
    before_diff: Vec<u8>,
    after_diff: Vec<u8>,
    layer_index: i32,
) {
    let layer = ctx
        .db
        .layer()
        .project_index()
        .filter((&project_id, &layer_index))
        .next()
        .expect("No layer for this project");

    let mut before_data = VoxelCompression::decompress(&before_diff);
    let after_data = VoxelCompression::decompress(&after_diff);
    let layer_data = VoxelCompression::decompress(&layer.voxels);

    for i in 0..before_data.len() {
        if after_data[i] != layer_data[i] {
            before_data[i] = 0;
        }
    }

    modify_block(ctx, project_id, before_data, layer_index);
}

pub fn update_block(ctx: &ReducerContext, project_id: String, index: i32, face_colors: Vec<i32>) {
    if project_id.is_empty() {
        panic!("Project ID cannot be null or empty.");
    }

    let mut project_blocks = ctx
        .db
        .project_blocks()
        .project_id()
        .find(&project_id)
        .expect("No blocks found for this project");

    ensure_access_to_project(ctx, &project_id, &ctx.sender).expect("Access denied");

    if index < 0 || index as usize >= project_blocks.face_colors.len() {
        panic!("Block index is out of range.");
    }

    if face_colors.len() != 6 {
        panic!("Atlas face indexes must be an array of length 6.");
    }

    project_blocks.face_colors[index as usize] = face_colors;
    ctx.db.project_blocks().project_id().update(project_blocks);
}
