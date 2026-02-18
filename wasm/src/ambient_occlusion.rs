pub const OCCLUSION_LEVELS: [f32; 4] = [1.0, 0.9, 0.85, 0.75];

const FACE_TANGENTS_FLAT: [i8; 36] = [
    0, 1, 0, 0, 0, 1, // Face 0 (+X)
    0, 1, 0, 0, 0, 1, // Face 1 (-X)
    1, 0, 0, 0, 0, 1, // Face 2 (+Y)
    1, 0, 0, 0, 0, 1, // Face 3 (-Y)
    1, 0, 0, 0, 1, 0, // Face 4 (+Z)
    1, 0, 0, 0, 1, 0, // Face 5 (-Z)
];

#[inline(always)]
fn is_occluder_at(
    x: i32,
    y: i32,
    z: i32,
    voxel_data: &[u8],
    dim_x: i32,
    dim_y: i32,
    dim_z: i32,
    stride_x: i32,
) -> bool {
    if x < 0 || x >= dim_x || y < 0 || y >= dim_y || z < 0 || z >= dim_z {
        return false;
    }
    (voxel_data[(x * stride_x + y * dim_z + z) as usize] & 0x7F) != 0
}

pub fn calculate_ambient_occlusion(
    nx: i32,
    ny: i32,
    nz: i32,
    face_dir: usize,
    voxel_data: &[u8],
    dim_x: i32,
    dim_y: i32,
    dim_z: i32,
    stride_x: i32,
) -> u8 {
    let offset = face_dir * 6;
    let u0 = FACE_TANGENTS_FLAT[offset] as i32;
    let u1 = FACE_TANGENTS_FLAT[offset + 1] as i32;
    let u2 = FACE_TANGENTS_FLAT[offset + 2] as i32;
    let v0 = FACE_TANGENTS_FLAT[offset + 3] as i32;
    let v1 = FACE_TANGENTS_FLAT[offset + 4] as i32;
    let v2 = FACE_TANGENTS_FLAT[offset + 5] as i32;

    let side1_neg = is_occluder_at(nx - u0, ny - u1, nz - u2, voxel_data, dim_x, dim_y, dim_z, stride_x);
    let side1_pos = is_occluder_at(nx + u0, ny + u1, nz + u2, voxel_data, dim_x, dim_y, dim_z, stride_x);
    let side2_neg = is_occluder_at(nx - v0, ny - v1, nz - v2, voxel_data, dim_x, dim_y, dim_z, stride_x);
    let side2_pos = is_occluder_at(nx + v0, ny + v1, nz + v2, voxel_data, dim_x, dim_y, dim_z, stride_x);

    let corner_nn = is_occluder_at(nx - u0 - v0, ny - u1 - v1, nz - u2 - v2, voxel_data, dim_x, dim_y, dim_z, stride_x);
    let corner_pn = is_occluder_at(nx + u0 - v0, ny + u1 - v1, nz + u2 - v2, voxel_data, dim_x, dim_y, dim_z, stride_x);
    let corner_np = is_occluder_at(nx - u0 + v0, ny - u1 + v1, nz - u2 + v2, voxel_data, dim_x, dim_y, dim_z, stride_x);
    let corner_pp = is_occluder_at(nx + u0 + v0, ny + u1 + v1, nz + u2 + v2, voxel_data, dim_x, dim_y, dim_z, stride_x);

    let occ00 = if side1_neg && side2_neg {
        3
    } else {
        (side1_neg as u8) + (side2_neg as u8) + (corner_nn as u8)
    };
    let occ10 = if side1_pos && side2_neg {
        3
    } else {
        (side1_pos as u8) + (side2_neg as u8) + (corner_pn as u8)
    };
    let occ11 = if side1_pos && side2_pos {
        3
    } else {
        (side1_pos as u8) + (side2_pos as u8) + (corner_pp as u8)
    };
    let occ01 = if side1_neg && side2_pos {
        3
    } else {
        (side1_neg as u8) + (side2_pos as u8) + (corner_np as u8)
    };

    occ00 | (occ10 << 2) | (occ11 << 4) | (occ01 << 6)
}
