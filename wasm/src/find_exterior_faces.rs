use crate::ambient_occlusion::{calculate_ambient_occlusion, OCCLUSION_LEVELS};
use crate::mesh_arrays::MeshArrays;
use crate::texture_coords::get_texture_coordinates;
use crate::voxel_constants::FACES;

const PACKED_PRESENT_BIT: i32 = 1 << 19;

pub struct ExteriorFacesFinder {
    packed_mask: Vec<i32>,
    processed: Vec<u8>,
    mask_size: usize,
    max_dim: usize,
}

impl ExteriorFacesFinder {
    pub fn new(max_dimension: usize) -> Self {
        let mask_size = max_dimension * max_dimension;
        Self {
            packed_mask: vec![0; mask_size],
            processed: vec![0; mask_size],
            mask_size,
            max_dim: max_dimension,
        }
    }

    pub fn find_exterior_faces(
        &mut self,
        voxel_data: &[u8],
        texture_width: i32,
        block_atlas_mapping: &[i32],
        dim_x: usize,
        dim_y: usize,
        dim_z: usize,
        mesh_arrays: &mut MeshArrays,
        selection_data: &[u8],
        selection_dim_x: usize,
        selection_dim_y: usize,
        selection_dim_z: usize,
        selection_empty: bool,
    ) {
        mesh_arrays.reset();

        let max_dimension = dim_x.max(dim_y).max(dim_z);
        let current_mask_size = max_dimension * max_dimension;

        if current_mask_size > self.mask_size {
            self.mask_size = current_mask_size;
            self.max_dim = max_dimension;
            self.packed_mask = vec![0; current_mask_size];
            self.processed = vec![0; current_mask_size];
        }

        let stride_x = dim_y * dim_z;
        let max_dim = self.max_dim;
        let dims = [dim_x, dim_y, dim_z];

        for axis in 0..3usize {
            let u = (axis + 1) % 3;
            let v = (axis + 2) % 3;

            let axis_size = dims[axis];
            let u_size = dims[u];
            let v_size = dims[v];

            for dir_idx in 0..2usize {
                let dir: i32 = if dir_idx == 0 { -1 } else { 1 };
                let face_dir = axis * 2 + if dir > 0 { 0 } else { 1 };
                let dx: i32 = if axis == 0 { dir } else { 0 };
                let dy: i32 = if axis == 1 { dir } else { 0 };
                let dz: i32 = if axis == 2 { dir } else { 0 };
                let neighbor_max = dims[axis] as i32;

                let x_is_depth = axis == 0;
                let y_is_depth = axis == 1;
                let z_is_depth = axis == 2;
                let x_is_u_axis = !x_is_depth && u == 0;
                let y_is_u_axis = !y_is_depth && u == 1;
                let z_is_u_axis = !z_is_depth && u == 2;

                for d in 0..axis_size {
                    for iv in 0..v_size {
                        let row_offset = iv * max_dim;
                        for i in row_offset..row_offset + u_size {
                            self.packed_mask[i] = 0;
                        }
                    }

                    let mut has_faces = false;

                    for iu in 0..u_size {
                        for iv in 0..v_size {
                            let x = if x_is_depth { d } else if x_is_u_axis { iu } else { iv };
                            let y = if y_is_depth { d } else if y_is_u_axis { iu } else { iv };
                            let z = if z_is_depth { d } else if z_is_u_axis { iu } else { iv };

                            let block_value = voxel_data[x * stride_x + y * dim_z + z];
                            let block_type = block_value & 0x7F;
                            let block_visible = block_type != 0;
                            let block_is_selected = !selection_empty
                                && is_selection_set(
                                    selection_data,
                                    x,
                                    y,
                                    z,
                                    selection_dim_x,
                                    selection_dim_y,
                                    selection_dim_z,
                                );

                            if !block_visible && !block_is_selected {
                                continue;
                            }

                            let nx = x as i32 + dx;
                            let ny = y as i32 + dy;
                            let nz = z as i32 + dz;

                            let mask_idx = iv * max_dim + iu;

                            if block_is_selected && !block_visible {
                                let neighbor_coord = if x_is_depth {
                                    nx
                                } else if y_is_depth {
                                    ny
                                } else {
                                    nz
                                };
                                let neighbor_in_bounds = if dir > 0 {
                                    neighbor_coord < neighbor_max
                                } else {
                                    neighbor_coord >= 0
                                };
                                let neighbor_is_selected = neighbor_in_bounds
                                    && is_selection_set(
                                        selection_data,
                                        nx as usize,
                                        ny as usize,
                                        nz as usize,
                                        selection_dim_x,
                                        selection_dim_y,
                                        selection_dim_z,
                                    );

                                if !neighbor_is_selected {
                                    let selection_block_type = get_selection_value(
                                        selection_data,
                                        x,
                                        y,
                                        z,
                                        selection_dim_x,
                                        selection_dim_y,
                                        selection_dim_z,
                                    ) & 0x7F;
                                    let texture_index = block_atlas_mapping
                                        [(selection_block_type.max(1) - 1) as usize];

                                    let ao = calculate_ambient_occlusion(
                                        nx,
                                        ny,
                                        nz,
                                        face_dir,
                                        voxel_data,
                                        dim_x as i32,
                                        dim_y as i32,
                                        dim_z as i32,
                                        stride_x as i32,
                                    );

                                    self.packed_mask[mask_idx] = PACKED_PRESENT_BIT
                                        | (texture_index & 0x3FF)
                                        | ((ao as i32 & 0xFF) << 10)
                                        | (1 << 18);
                                    has_faces = true;
                                }
                            } else if block_visible {
                                let neighbor_coord = if x_is_depth {
                                    nx
                                } else if y_is_depth {
                                    ny
                                } else {
                                    nz
                                };
                                let neighbor_in_bounds = if dir > 0 {
                                    neighbor_coord < neighbor_max
                                } else {
                                    neighbor_coord >= 0
                                };
                                let neighbor_visible = neighbor_in_bounds
                                    && (voxel_data
                                        [(nx as usize) * stride_x + (ny as usize) * dim_z + (nz as usize)]
                                        & 0x7F)
                                        != 0;

                                if !neighbor_visible {
                                    let texture_index =
                                        block_atlas_mapping[(block_type - 1) as usize];

                                    let ao = calculate_ambient_occlusion(
                                        nx,
                                        ny,
                                        nz,
                                        face_dir,
                                        voxel_data,
                                        dim_x as i32,
                                        dim_y as i32,
                                        dim_z as i32,
                                        stride_x as i32,
                                    );

                                    let sel = if block_is_selected { 1i32 } else { 0i32 };
                                    self.packed_mask[mask_idx] = PACKED_PRESENT_BIT
                                        | (texture_index & 0x3FF)
                                        | ((ao as i32 & 0xFF) << 10)
                                        | (sel << 18);
                                    has_faces = true;
                                }
                            }
                        }
                    }

                    if has_faces {
                        self.generate_greedy_mesh(
                            u_size,
                            v_size,
                            d,
                            axis,
                            u,
                            v,
                            dir,
                            face_dir,
                            texture_width,
                            mesh_arrays,
                        );
                    }
                }
            }
        }
    }

    fn generate_greedy_mesh(
        &mut self,
        width: usize,
        height: usize,
        depth: usize,
        axis: usize,
        u: usize,
        v: usize,
        dir: i32,
        face_dir: usize,
        texture_width: i32,
        mesh_arrays: &mut MeshArrays,
    ) {
        let stride = self.max_dim;
        let normal = FACES[face_dir].normal;
        let face_offset: f32 = if dir > 0 { 1.0 } else { 0.0 };

        for iv in 0..height {
            let row_offset = iv * stride;
            for i in row_offset..row_offset + width {
                self.processed[i] = 0;
            }
        }

        let mut j = 0;
        while j < height {
            let j_offset = j * stride;
            let mut i = 0;
            while i < width {
                let ji = j_offset + i;
                if self.processed[ji] != 0 || (self.packed_mask[ji] & PACKED_PRESENT_BIT) == 0 {
                    i += 1;
                    continue;
                }

                let packed = self.packed_mask[ji];
                let texture_index = packed & 0x3FF;
                let ao_val = ((packed >> 10) & 0xFF) as u8;
                let is_selected = ((packed >> 18) & 0x1) as u8;
                let mut quad_width = 1usize;

                while i + quad_width < width {
                    let idx = j_offset + i + quad_width;
                    if self.processed[idx] != 0
                        || self.packed_mask[idx] != packed
                    {
                        break;
                    }
                    quad_width += 1;
                }

                let mut quad_height = 1usize;
                'outer: while j + quad_height < height {
                    let row_off = (j + quad_height) * stride;
                    for w in 0..quad_width {
                        let idx = row_off + i + w;
                        if self.processed[idx] != 0
                            || self.packed_mask[idx] != packed
                        {
                            break 'outer;
                        }
                    }
                    quad_height += 1;
                }

                let end_i = i + quad_width;
                let end_j = j + quad_height;
                for jj in j..end_j {
                    let row_off = jj * stride;
                    for ii in i..end_i {
                        self.processed[row_off + ii] = 1;
                    }
                }

                let x = if axis == 0 {
                    depth
                } else if u == 0 {
                    i
                } else if v == 0 {
                    j
                } else {
                    0
                };
                let y = if axis == 1 {
                    depth
                } else if u == 1 {
                    i
                } else if v == 1 {
                    j
                } else {
                    0
                };
                let z = if axis == 2 {
                    depth
                } else if u == 2 {
                    i
                } else if v == 2 {
                    j
                } else {
                    0
                };

                let texture_coords =
                    get_texture_coordinates(texture_index as i32, texture_width);

                let start_vertex_index = mesh_arrays.vertex_count as u32;

                for vi in 0..4u32 {
                    let actual_vi = if dir < 0 && (vi == 1 || vi == 3) {
                        if vi == 1 { 3 } else { 1 }
                    } else {
                        vi
                    };

                    let (vx, vy, vz): (f32, f32, f32);

                    if axis == 0 {
                        vx = x as f32 + face_offset;
                        match actual_vi {
                            0 => {
                                vy = y as f32;
                                vz = z as f32;
                            }
                            1 => {
                                vy = y as f32
                                    + if u == 1 { quad_width as f32 } else { 0.0 };
                                vz = z as f32
                                    + if u == 2 { quad_width as f32 } else { 0.0 };
                            }
                            2 => {
                                vy = y as f32
                                    + if u == 1 {
                                        quad_width as f32
                                    } else if v == 1 {
                                        quad_height as f32
                                    } else {
                                        0.0
                                    };
                                vz = z as f32
                                    + if u == 2 {
                                        quad_width as f32
                                    } else if v == 2 {
                                        quad_height as f32
                                    } else {
                                        0.0
                                    };
                            }
                            _ => {
                                vy = y as f32
                                    + if v == 1 { quad_height as f32 } else { 0.0 };
                                vz = z as f32
                                    + if v == 2 { quad_height as f32 } else { 0.0 };
                            }
                        }
                    } else if axis == 1 {
                        vy = y as f32 + face_offset;
                        match actual_vi {
                            0 => {
                                vx = x as f32;
                                vz = z as f32;
                            }
                            1 => {
                                vx = x as f32
                                    + if u == 0 { quad_width as f32 } else { 0.0 };
                                vz = z as f32
                                    + if u == 2 { quad_width as f32 } else { 0.0 };
                            }
                            2 => {
                                vx = x as f32
                                    + if u == 0 {
                                        quad_width as f32
                                    } else if v == 0 {
                                        quad_height as f32
                                    } else {
                                        0.0
                                    };
                                vz = z as f32
                                    + if u == 2 {
                                        quad_width as f32
                                    } else if v == 2 {
                                        quad_height as f32
                                    } else {
                                        0.0
                                    };
                            }
                            _ => {
                                vx = x as f32
                                    + if v == 0 { quad_height as f32 } else { 0.0 };
                                vz = z as f32
                                    + if v == 2 { quad_height as f32 } else { 0.0 };
                            }
                        }
                    } else {
                        vz = z as f32 + face_offset;
                        match actual_vi {
                            0 => {
                                vx = x as f32;
                                vy = y as f32;
                            }
                            1 => {
                                vx = x as f32
                                    + if u == 0 { quad_width as f32 } else { 0.0 };
                                vy = y as f32
                                    + if u == 1 { quad_width as f32 } else { 0.0 };
                            }
                            2 => {
                                vx = x as f32
                                    + if u == 0 {
                                        quad_width as f32
                                    } else if v == 0 {
                                        quad_height as f32
                                    } else {
                                        0.0
                                    };
                                vy = y as f32
                                    + if u == 1 {
                                        quad_width as f32
                                    } else if v == 1 {
                                        quad_height as f32
                                    } else {
                                        0.0
                                    };
                            }
                            _ => {
                                vx = x as f32
                                    + if v == 0 { quad_height as f32 } else { 0.0 };
                                vy = y as f32
                                    + if v == 1 { quad_height as f32 } else { 0.0 };
                            }
                        }
                    }

                    mesh_arrays.push_vertex(vx, vy, vz);
                    mesh_arrays.push_normal(normal[0], normal[1], normal[2]);
                    mesh_arrays.push_uv(
                        texture_coords[(vi * 2) as usize] as f32,
                        texture_coords[(vi * 2 + 1) as usize] as f32,
                    );

                    let packed_ao = ao_val;

                    let ao_corner_index =
                        if face_dir == 1 || face_dir == 2 || face_dir == 5 {
                            if vi == 1 { 3 } else if vi == 3 { 1 } else { vi }
                        } else {
                            vi
                        };

                    let occlusion_count =
                        (packed_ao >> (ao_corner_index * 2)) & 0x03;
                    let ao_factor = OCCLUSION_LEVELS[occlusion_count as usize];
                    mesh_arrays.push_ao(ao_factor);
                    mesh_arrays.push_is_selected(is_selected);
                    mesh_arrays.increment_vertex();
                }

                mesh_arrays.push_index(start_vertex_index);
                mesh_arrays.push_index(start_vertex_index + 1);
                mesh_arrays.push_index(start_vertex_index + 2);
                mesh_arrays.push_index(start_vertex_index);
                mesh_arrays.push_index(start_vertex_index + 2);
                mesh_arrays.push_index(start_vertex_index + 3);

                i += quad_width;
            }
            j += 1;
        }
    }
}

#[inline(always)]
fn is_selection_set(
    selection_data: &[u8],
    x: usize,
    y: usize,
    z: usize,
    sel_dim_x: usize,
    sel_dim_y: usize,
    sel_dim_z: usize,
) -> bool {
    if x >= sel_dim_x || y >= sel_dim_y || z >= sel_dim_z {
        return false;
    }
    selection_data[x * sel_dim_y * sel_dim_z + y * sel_dim_z + z] != 0
}

#[inline(always)]
fn get_selection_value(
    selection_data: &[u8],
    x: usize,
    y: usize,
    z: usize,
    sel_dim_x: usize,
    sel_dim_y: usize,
    sel_dim_z: usize,
) -> u8 {
    if x >= sel_dim_x || y >= sel_dim_y || z >= sel_dim_z {
        return 0;
    }
    selection_data[x * sel_dim_y * sel_dim_z + y * sel_dim_z + z]
}
