pub const OCCLUSION_LEVELS: [f32; 4] = [1.0, 0.9, 0.85, 0.75];

pub struct AoOffsets {
    pub offsets: [i32; 8],
    pub u_axis: usize,
    pub v_axis: usize,
    pub n_axis: usize,
}

pub fn precompute_ao_offsets(face_dir: usize, stride_x: i32, dim_z: i32) -> AoOffsets {
    const TANGENT_AXES: [(usize, usize, usize); 6] = [
        (1, 2, 0), // Face 0 (+X)
        (1, 2, 0), // Face 1 (-X)
        (0, 2, 1), // Face 2 (+Y)
        (0, 2, 1), // Face 3 (-Y)
        (0, 1, 2), // Face 4 (+Z)
        (0, 1, 2), // Face 5 (-Z)
    ];

    let (u_axis, v_axis, n_axis) = TANGENT_AXES[face_dir];

    let mut axis_stride = [0i32; 3];
    axis_stride[0] = stride_x;
    axis_stride[1] = dim_z;
    axis_stride[2] = 1;

    let u_stride = axis_stride[u_axis];
    let v_stride = axis_stride[v_axis];

    AoOffsets {
        offsets: [
            -u_stride,
            u_stride,
            -v_stride,
            v_stride,
            -u_stride - v_stride,
            u_stride - v_stride,
            -u_stride + v_stride,
            u_stride + v_stride,
        ],
        u_axis,
        v_axis,
        n_axis,
    }
}

#[inline(always)]
pub fn calculate_ambient_occlusion(
    nx: i32,
    ny: i32,
    nz: i32,
    voxel_data: &[u8],
    dim_x: i32,
    dim_y: i32,
    dim_z: i32,
    center_idx: i32,
    ao_offsets: &AoOffsets,
) -> u8 {
    let offsets = &ao_offsets.offsets;
    let n = [nx, ny, nz];
    let dims = [dim_x, dim_y, dim_z];

    let nn = n[ao_offsets.n_axis];
    let dim_n = dims[ao_offsets.n_axis];
    if nn < 0 || nn >= dim_n {
        return 0;
    }

    let nu = n[ao_offsets.u_axis];
    let nv = n[ao_offsets.v_axis];
    let dim_u = dims[ao_offsets.u_axis];
    let dim_v = dims[ao_offsets.v_axis];

    let u_neg_ok = nu > 0;
    let u_pos_ok = nu < dim_u - 1;
    let v_neg_ok = nv > 0;
    let v_pos_ok = nv < dim_v - 1;

    #[inline(always)]
    fn is_solid(voxel_data: &[u8], idx: i32) -> bool {
        (voxel_data[idx as usize] & 0x7F) != 0
    }

    let side1_neg = u_neg_ok && is_solid(voxel_data, center_idx + offsets[0]);
    let side1_pos = u_pos_ok && is_solid(voxel_data, center_idx + offsets[1]);
    let side2_neg = v_neg_ok && is_solid(voxel_data, center_idx + offsets[2]);
    let side2_pos = v_pos_ok && is_solid(voxel_data, center_idx + offsets[3]);

    let occ00 = if side1_neg && side2_neg {
        3
    } else {
        let corner_nn = u_neg_ok && v_neg_ok && is_solid(voxel_data, center_idx + offsets[4]);
        (side1_neg as u8) + (side2_neg as u8) + (corner_nn as u8)
    };
    let occ10 = if side1_pos && side2_neg {
        3
    } else {
        let corner_pn = u_pos_ok && v_neg_ok && is_solid(voxel_data, center_idx + offsets[5]);
        (side1_pos as u8) + (side2_neg as u8) + (corner_pn as u8)
    };
    let occ11 = if side1_pos && side2_pos {
        3
    } else {
        let corner_pp = u_pos_ok && v_pos_ok && is_solid(voxel_data, center_idx + offsets[7]);
        (side1_pos as u8) + (side2_pos as u8) + (corner_pp as u8)
    };
    let occ01 = if side1_neg && side2_pos {
        3
    } else {
        let corner_np = u_neg_ok && v_pos_ok && is_solid(voxel_data, center_idx + offsets[6]);
        (side1_neg as u8) + (side2_pos as u8) + (corner_np as u8)
    };

    occ00 | (occ10 << 2) | (occ11 << 4) | (occ01 << 6)
}
