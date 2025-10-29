use voxel_compression::VoxelCompression;
use voxel_compression::VoxelDataUtils;
use wasm_bindgen::prelude::*;

const MAX_LAYERS: usize = 10;

struct Layer {
    voxels: Vec<u32>,
    visible: bool,
}

// Helper function to apply a layer on top of existing voxels
fn add_layer_to_voxels(layer: &Layer, voxels: &mut Vec<u32>) {
    for i in 0..voxels.len() {
        if i < layer.voxels.len() && VoxelDataUtils::is_block_present(layer.voxels[i]) {
            voxels[i] = layer.voxels[i];
        }
    }
}

#[wasm_bindgen(js_name = decompressVoxelData)]
pub fn decompress_voxel_data(compressed_data: &[u8]) -> Vec<u32> {
    VoxelCompression::decompress(compressed_data)
}

#[wasm_bindgen]
pub struct RenderPipeline {
    layers: [Option<Layer>; MAX_LAYERS],
    voxels_to_render: Vec<u32>,
    rendered_voxels: Vec<u32>,
    dim_x: usize,
    dim_y: usize,
    dim_z: usize,
    texture_width: usize,
    block_atlas_mappings: Vec<u32>,
    num_block_types: usize,
    real_mesh_arrays: MeshArrays,
    preview_mesh_arrays: MeshArrays,
    selection_mesh_arrays: MeshArrays,
}

#[wasm_bindgen]
impl RenderPipeline {
    #[wasm_bindgen(constructor)]
    pub fn new(dim_x: usize, dim_y: usize, dim_z: usize) -> RenderPipeline {
        let voxel_count = dim_x * dim_y * dim_z;
        let max_vertices = voxel_count * 24; // Estimate
        let max_indices = max_vertices * 2;
        
        RenderPipeline { 
            layers: [
                None, None, None, None, None,
                None, None, None, None, None,
            ],
            voxels_to_render: vec![0; voxel_count],
            rendered_voxels: vec![0; voxel_count],
            dim_x,
            dim_y,
            dim_z,
            texture_width: 1,
            block_atlas_mappings: Vec::new(),
            num_block_types: 0,
            real_mesh_arrays: MeshArrays::new(max_vertices, max_indices),
            preview_mesh_arrays: MeshArrays::new(max_vertices, max_indices),
            selection_mesh_arrays: MeshArrays::new(max_vertices, max_indices),
        }
    }
    
    #[wasm_bindgen(js_name = updateDimensions)]
    pub fn update_dimensions(&mut self, dim_x: usize, dim_y: usize, dim_z: usize) {
        if self.dim_x != dim_x || self.dim_y != dim_y || self.dim_z != dim_z {
            self.dim_x = dim_x;
            self.dim_y = dim_y;
            self.dim_z = dim_z;
            let voxel_count = dim_x * dim_y * dim_z;
            self.voxels_to_render.resize(voxel_count, 0);
            self.rendered_voxels.resize(voxel_count, 0);
        }
    }
    
        #[wasm_bindgen(js_name = updateAtlasData)]
    pub fn update_atlas_data(&mut self, block_atlas_mappings: Vec<u32>, texture_width: usize) {
        self.num_block_types = if block_atlas_mappings.is_empty() {
            0
        } else {
            block_atlas_mappings.len() / 6
        };
        self.block_atlas_mappings = block_atlas_mappings;
        self.texture_width = texture_width;
    }

    #[wasm_bindgen(js_name = addLayer)]
    pub fn add_layer(&mut self, index: usize, compressed_voxels: &[u8], visible: bool) {
        if index < MAX_LAYERS {
            self.layers[index] = Some(Layer {
                voxels: VoxelCompression::decompress(compressed_voxels),
                visible: visible,
            });
        }
    }

    #[wasm_bindgen(js_name = updateLayer)]
    pub fn update_layer(&mut self, index: usize, compressed_voxels: &[u8], visible: bool) {
        if index < MAX_LAYERS {
            self.layers[index] = Some(Layer {
                voxels: VoxelCompression::decompress(compressed_voxels),
                visible: visible,
            });
        }
    }

    #[wasm_bindgen(js_name = render)]
    pub fn render(
        &mut self,
        preview_hidden: bool,
        disable_greedy_meshing: bool,
    ) -> Option<MeshResult> {
        let mut first_layer = true;
        for layer_opt in &self.layers {
            if let Some(layer) = layer_opt {
                if layer.visible {
                    if first_layer {
                        if self.voxels_to_render.len() != layer.voxels.len() {
                            self.voxels_to_render.resize(layer.voxels.len(), 0);
                        }
                        self.voxels_to_render.copy_from_slice(&layer.voxels);
                        first_layer = false;
                    } else {
                        add_layer_to_voxels(layer, &mut self.voxels_to_render);
                    }
                }
            }
        }
        
        if !first_layer {
            let has_changes = if self.rendered_voxels.len() != self.voxels_to_render.len() {
                true
            } else {
                self.rendered_voxels.iter()
                    .zip(self.voxels_to_render.iter())
                    .any(|(a, b)| a != b)
            };
            
            if has_changes {
                if self.rendered_voxels.len() != self.voxels_to_render.len() {
                    self.rendered_voxels.resize(self.voxels_to_render.len(), 0);
                }
                self.rendered_voxels.copy_from_slice(&self.voxels_to_render);
                
                find_exterior_faces(
                    &self.voxels_to_render,
                    self.dim_x,
                    self.dim_y,
                    self.dim_z,
                    self.texture_width,
                    &self.block_atlas_mappings,
                    self.num_block_types,
                    preview_hidden,
                    disable_greedy_meshing,
                    &mut self.real_mesh_arrays,
                    &mut self.preview_mesh_arrays,
                    &mut self.selection_mesh_arrays,
                );
                
                return Some(MeshResult {
                    real_mesh: MeshData {
                        vertices: std::mem::take(&mut self.real_mesh_arrays.vertices),
                        normals: std::mem::take(&mut self.real_mesh_arrays.normals),
                        uvs: std::mem::take(&mut self.real_mesh_arrays.uvs),
                        ao: std::mem::take(&mut self.real_mesh_arrays.ao),
                        indices: std::mem::take(&mut self.real_mesh_arrays.indices),
                    },
                    preview_mesh: MeshData {
                        vertices: std::mem::take(&mut self.preview_mesh_arrays.vertices),
                        normals: std::mem::take(&mut self.preview_mesh_arrays.normals),
                        uvs: std::mem::take(&mut self.preview_mesh_arrays.uvs),
                        ao: std::mem::take(&mut self.preview_mesh_arrays.ao),
                        indices: std::mem::take(&mut self.preview_mesh_arrays.indices),
                    },
                    selection_mesh: MeshData {
                        vertices: std::mem::take(&mut self.selection_mesh_arrays.vertices),
                        normals: std::mem::take(&mut self.selection_mesh_arrays.normals),
                        uvs: std::mem::take(&mut self.selection_mesh_arrays.uvs),
                        ao: std::mem::take(&mut self.selection_mesh_arrays.ao),
                        indices: std::mem::take(&mut self.selection_mesh_arrays.indices),
                    },
                });
            }
        }
        
        None
    }
}

// Constants for voxel data manipulation
const SELECTED_BIT_MASK: u32 = 0x10;

// Occlusion levels
const OCCLUSION_LEVELS: [f32; 4] = [1.0, 0.9, 0.85, 0.75];

// Face normals [x, y, z]
const FACE_NORMALS: [[f32; 3]; 6] = [
    [1.0, 0.0, 0.0],  // +X (face 0)
    [-1.0, 0.0, 0.0], // -X (face 1)
    [0.0, 1.0, 0.0],  // +Y (face 2)
    [0.0, -1.0, 0.0], // -Y (face 3)
    [0.0, 0.0, 1.0],  // +Z (face 4)
    [0.0, 0.0, -1.0], // -Z (face 5)
];

// Face tangent directions [u_dir, v_dir]
const FACE_TANGENTS: [[[i32; 3]; 2]; 6] = [
    [[0, 1, 0], [0, 0, 1]], // Face 0: +X
    [[0, 1, 0], [0, 0, 1]], // Face 1: -X
    [[1, 0, 0], [0, 0, 1]], // Face 2: +Y
    [[1, 0, 0], [0, 0, 1]], // Face 3: -Y
    [[1, 0, 0], [0, 1, 0]], // Face 4: +Z
    [[1, 0, 0], [0, 1, 0]], // Face 5: -Z
];

#[wasm_bindgen]
pub struct Vector3 {
    pub x: usize,
    pub y: usize,
    pub z: usize,
}

#[wasm_bindgen]
impl Vector3 {
    #[wasm_bindgen(constructor)]
    pub fn new(x: usize, y: usize, z: usize) -> Vector3 {
        Vector3 { x, y, z }
    }
}

#[wasm_bindgen]
pub struct MeshData {
    vertices: Vec<f32>,
    normals: Vec<f32>,
    uvs: Vec<f32>,
    ao: Vec<f32>,
    indices: Vec<u32>,
}

#[wasm_bindgen]
impl MeshData {
    #[wasm_bindgen(getter)]
    pub fn vertices(&self) -> Vec<f32> {
        self.vertices.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn normals(&self) -> Vec<f32> {
        self.normals.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn uvs(&self) -> Vec<f32> {
        self.uvs.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn ao(&self) -> Vec<f32> {
        self.ao.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn indices(&self) -> Vec<u32> {
        self.indices.clone()
    }
}

#[wasm_bindgen]
pub struct MeshResult {
    real_mesh: MeshData,
    preview_mesh: MeshData,
    selection_mesh: MeshData,
}

#[wasm_bindgen]
impl MeshResult {
    #[wasm_bindgen(js_name = realMesh)]
    pub fn real_mesh(self) -> MeshData {
        self.real_mesh
    }

    #[wasm_bindgen(js_name = previewMesh)]
    pub fn preview_mesh(self) -> MeshData {
        self.preview_mesh
    }

    #[wasm_bindgen(js_name = selectionMesh)]
    pub fn selection_mesh(self) -> MeshData {
        self.selection_mesh
    }
}

struct MeshArrays {
    vertices: Vec<f32>,
    normals: Vec<f32>,
    uvs: Vec<f32>,
    ao: Vec<f32>,
    indices: Vec<u32>,
    vertex_count: u32,
}

impl MeshArrays {
    fn new(max_vertices: usize, max_indices: usize) -> Self {
        MeshArrays {
            vertices: Vec::with_capacity(max_vertices * 3),
            normals: Vec::with_capacity(max_vertices * 3),
            uvs: Vec::with_capacity(max_vertices * 2),
            ao: Vec::with_capacity(max_vertices),
            indices: Vec::with_capacity(max_indices),
            vertex_count: 0,
        }
    }

    fn reset(&mut self) {
        self.vertices.clear();
        self.normals.clear();
        self.uvs.clear();
        self.ao.clear();
        self.indices.clear();
        self.vertex_count = 0;
    }

    fn push_vertex(&mut self, x: f32, y: f32, z: f32) {
        self.vertices.push(x);
        self.vertices.push(y);
        self.vertices.push(z);
    }

    fn push_normal(&mut self, x: f32, y: f32, z: f32) {
        self.normals.push(x);
        self.normals.push(y);
        self.normals.push(z);
    }

    fn push_uv(&mut self, u: f32, v: f32) {
        self.uvs.push(u);
        self.uvs.push(v);
    }

    fn push_ao(&mut self, value: f32) {
        self.ao.push(value);
    }

    fn increment_vertex(&mut self) {
        self.vertex_count += 1;
    }

    fn push_index(&mut self, index: u32) {
        self.indices.push(index);
    }
}

fn is_selected(block_value: u32) -> bool {
    (block_value & SELECTED_BIT_MASK) != 0
}

// Texture coordinate calculation
fn get_texture_coordinates(texture_index: i16, texture_width: usize) -> [f32; 8] {
    let texture_size = 1.0 / texture_width as f32;
    let half_pixel = texture_size * 0.5;
    let u = ((texture_index as usize) % texture_width) as f32 * texture_size + half_pixel;
    let v = ((texture_index as usize) / texture_width) as f32 * texture_size + half_pixel;
    let flipped_v = 1.0 - v;
    [u, flipped_v, u, flipped_v, u, flipped_v, u, flipped_v]
}

// Ambient occlusion calculation
fn calculate_ambient_occlusion<F>(
    nx: i32,
    ny: i32,
    nz: i32,
    face_dir: usize,
    get_neighbor_block: &F,
    preview_hidden: bool,
) -> u8
where
    F: Fn(i32, i32, i32) -> u32,
{
    let tangent = &FACE_TANGENTS[face_dir];
    let u_dir = &tangent[0];
    let v_dir = &tangent[1];

    let is_occluder = |ox: i32, oy: i32, oz: i32| -> bool {
        let val = get_neighbor_block(nx + ox, ny + oy, nz + oz);
        VoxelDataUtils::is_block_present(val)
            && (!preview_hidden || !VoxelDataUtils::is_preview(val))
    };

    let side1_neg = is_occluder(-u_dir[0], -u_dir[1], -u_dir[2]);
    let side1_pos = is_occluder(u_dir[0], u_dir[1], u_dir[2]);
    let side2_neg = is_occluder(-v_dir[0], -v_dir[1], -v_dir[2]);
    let side2_pos = is_occluder(v_dir[0], v_dir[1], v_dir[2]);

    let corner_nn = is_occluder(
        -u_dir[0] - v_dir[0],
        -u_dir[1] - v_dir[1],
        -u_dir[2] - v_dir[2],
    );
    let corner_pn = is_occluder(
        u_dir[0] - v_dir[0],
        u_dir[1] - v_dir[1],
        u_dir[2] - v_dir[2],
    );
    let corner_np = is_occluder(
        -u_dir[0] + v_dir[0],
        -u_dir[1] + v_dir[1],
        -u_dir[2] + v_dir[2],
    );
    let corner_pp = is_occluder(
        u_dir[0] + v_dir[0],
        u_dir[1] + v_dir[1],
        u_dir[2] + v_dir[2],
    );

    let calculate_occlusion = |s1: bool, s2: bool, c: bool| -> u8 {
        if s1 && s2 {
            return 3; // Inner corner case
        }
        (if s1 { 1 } else { 0 }) + (if s2 { 1 } else { 0 }) + (if c { 1 } else { 0 })
    };

    let occ00 = calculate_occlusion(side1_neg, side2_neg, corner_nn);
    let occ10 = calculate_occlusion(side1_pos, side2_neg, corner_pn);
    let occ11 = calculate_occlusion(side1_pos, side2_pos, corner_pp);
    let occ01 = calculate_occlusion(side1_neg, side2_pos, corner_np);

    // Pack occlusion values (2 bits per corner)
    let mut occluder_mask = 0u8;
    occluder_mask |= occ00 << 0;
    occluder_mask |= occ10 << 2;
    occluder_mask |= occ11 << 4;
    occluder_mask |= occ01 << 6;

    occluder_mask
}

// Greedy meshing algorithm
fn generate_greedy_mesh(
    mask: &[i16],
    ao_mask: &[u8],
    processed: &mut [u8],
    width: usize,
    height: usize,
    depth: usize,
    axis: usize,
    u: usize,
    v: usize,
    dir: i32,
    face_dir: usize,
    texture_width: usize,
    mesh_arrays: &mut MeshArrays,
    disable_greedy_meshing: bool,
) {
    // Reset processed array
    for p in processed.iter_mut().take(width * height) {
        *p = 0;
    }

    let mut j = 0;
    while j < height {
        let mut i = 0;
        while i < width {
            let mask_index = i + j * width;

            if processed[mask_index] != 0 || mask[mask_index] < 0 {
                i += 1;
                continue;
            }

            let texture_index = mask[mask_index];
            let mut quad_width = 1;

            if !disable_greedy_meshing {
                while i + quad_width < width {
                    let idx = i + quad_width + j * width;
                    if processed[idx] != 0
                        || mask[idx] != texture_index
                        || ao_mask[idx] != ao_mask[mask_index]
                    {
                        break;
                    }
                    quad_width += 1;
                }
            }

            let mut quad_height = 1;
            if !disable_greedy_meshing {
                'outer: loop {
                    if j + quad_height >= height {
                        break;
                    }
                    for w in 0..quad_width {
                        let idx = i + w + (j + quad_height) * width;
                        if processed[idx] != 0
                            || mask[idx] != texture_index
                            || ao_mask[idx] != ao_mask[mask_index]
                        {
                            break 'outer;
                        }
                    }
                    quad_height += 1;
                }
            }

            // Mark as processed
            for jj in j..(j + quad_height) {
                for ii in i..(i + quad_width) {
                    processed[ii + jj * width] = 1;
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

            let face_offset = if dir > 0 { 1 } else { 0 };

            let mut vertices = [[0usize; 3]; 4];
            vertices[0] = [x, y, z];

            if axis == 0 {
                vertices[0][0] = x + face_offset;
                vertices[1][0] = x + face_offset;
                vertices[1][1] = y + if u == 1 { quad_width } else { 0 };
                vertices[1][2] = z + if u == 2 { quad_width } else { 0 };

                vertices[2][0] = x + face_offset;
                vertices[2][1] = y + if u == 1 {
                    quad_width
                } else if v == 1 {
                    quad_height
                } else {
                    0
                };
                vertices[2][2] = z + if u == 2 {
                    quad_width
                } else if v == 2 {
                    quad_height
                } else {
                    0
                };

                vertices[3][0] = x + face_offset;
                vertices[3][1] = y + if v == 1 { quad_height } else { 0 };
                vertices[3][2] = z + if v == 2 { quad_height } else { 0 };
            } else if axis == 1 {
                vertices[0][1] = y + face_offset;
                vertices[1][0] = x + if u == 0 { quad_width } else { 0 };
                vertices[1][1] = y + face_offset;
                vertices[1][2] = z + if u == 2 { quad_width } else { 0 };

                vertices[2][0] = x + if u == 0 {
                    quad_width
                } else if v == 0 {
                    quad_height
                } else {
                    0
                };
                vertices[2][1] = y + face_offset;
                vertices[2][2] = z + if u == 2 {
                    quad_width
                } else if v == 2 {
                    quad_height
                } else {
                    0
                };

                vertices[3][0] = x + if v == 0 { quad_height } else { 0 };
                vertices[3][1] = y + face_offset;
                vertices[3][2] = z + if v == 2 { quad_height } else { 0 };
            } else {
                vertices[0][2] = z + face_offset;
                vertices[1][0] = x + if u == 0 { quad_width } else { 0 };
                vertices[1][1] = y + if u == 1 { quad_width } else { 0 };
                vertices[1][2] = z + face_offset;

                vertices[2][0] = x + if u == 0 {
                    quad_width
                } else if v == 0 {
                    quad_height
                } else {
                    0
                };
                vertices[2][1] = y + if u == 1 {
                    quad_width
                } else if v == 1 {
                    quad_height
                } else {
                    0
                };
                vertices[2][2] = z + face_offset;

                vertices[3][0] = x + if v == 0 { quad_height } else { 0 };
                vertices[3][1] = y + if v == 1 { quad_height } else { 0 };
                vertices[3][2] = z + face_offset;
            }

            // Swap vertices for negative direction
            if dir < 0 {
                let temp = vertices[1];
                vertices[1] = vertices[3];
                vertices[3] = temp;
            }

            let texture_coords = get_texture_coordinates(texture_index, texture_width);
            let normal = FACE_NORMALS[face_dir];
            let start_vertex_index = mesh_arrays.vertex_count;

            // Add vertices with AO
            for vi in 0..4 {
                let vertex = vertices[vi];
                mesh_arrays.push_vertex(vertex[0] as f32, vertex[1] as f32, vertex[2] as f32);
                mesh_arrays.push_normal(normal[0], normal[1], normal[2]);
                mesh_arrays.push_uv(texture_coords[vi * 2], texture_coords[vi * 2 + 1]);

                let packed_ao = ao_mask[mask_index];

                // Determine AO corner index based on face direction
                let ao_corner_index = if face_dir == 1 || face_dir == 2 || face_dir == 5 {
                    // Swapped pattern
                    if vi == 1 {
                        3
                    } else if vi == 3 {
                        1
                    } else {
                        vi
                    }
                } else {
                    // Standard pattern
                    vi
                };

                let occlusion_count = (packed_ao >> (ao_corner_index * 2)) & 0x03;
                let ao_factor = OCCLUSION_LEVELS[occlusion_count as usize];
                mesh_arrays.push_ao(ao_factor);
                mesh_arrays.increment_vertex();
            }

            // Add indices
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

fn find_exterior_faces(
    voxel_data_flat: &[u32],
    dim_x: usize,
    dim_y: usize,
    dim_z: usize,
    texture_width: usize,
    block_atlas_mappings_flat: &[u32],
    num_block_types: usize,
    preview_hidden: bool,
    disable_greedy_meshing: bool,
    real_mesh: &mut MeshArrays,
    preview_mesh: &mut MeshArrays,
    selection_mesh: &mut MeshArrays,
) {
    // Reset the mesh arrays
    real_mesh.reset();
    preview_mesh.reset();
    selection_mesh.reset();
    
    // Reconstruct voxel data as 3D array
    let get_voxel = |x: usize, y: usize, z: usize| -> u32 {
        if x < dim_x && y < dim_y && z < dim_z {
            voxel_data_flat[x * dim_y * dim_z + y * dim_z + z]
        } else {
            0
        }
    };

    // Reconstruct block atlas mappings
    let get_texture_index = |block_type: usize, face: usize| -> usize {
        if block_type < num_block_types {
            block_atlas_mappings_flat[block_type * 6 + face] as usize
        } else {
            0
        }
    };

    let mask_size = dim_x.max(dim_y).max(dim_z).pow(2);

    let mut real_mask = vec![-1i16; mask_size];
    let mut preview_mask = vec![-1i16; mask_size];
    let mut selection_mask = vec![-1i16; mask_size];
    let mut processed = vec![0u8; mask_size];
    let mut ao_mask = vec![0u8; mask_size];

    let get_neighbor_block = |x: i32, y: i32, z: i32| -> u32 {
        if x >= 0 && x < dim_x as i32 && y >= 0 && y < dim_y as i32 && z >= 0 && z < dim_z as i32 {
            get_voxel(x as usize, y as usize, z as usize)
        } else {
            0
        }
    };

    // Iterate through each axis
    for axis in 0..3 {
        let u = (axis + 1) % 3;
        let v = (axis + 2) % 3;

        let axis_size = match axis {
            0 => dim_x,
            1 => dim_y,
            _ => dim_z,
        };

        let u_size = match u {
            0 => dim_x,
            1 => dim_y,
            _ => dim_z,
        };

        let v_size = match v {
            0 => dim_x,
            1 => dim_y,
            _ => dim_z,
        };

        for dir in [-1, 1].iter() {
            let face_dir = axis * 2 + if *dir > 0 { 0 } else { 1 };

            for d in 0..axis_size {
                // Reset masks
                for i in 0..(u_size * v_size) {
                    real_mask[i] = -1;
                    preview_mask[i] = -1;
                    selection_mask[i] = -1;
                    ao_mask[i] = 0;
                }

                for iu in 0..u_size {
                    for iv in 0..v_size {
                        let mask_index = iu + iv * u_size;

                        let x = if axis == 0 {
                            d
                        } else if u == 0 {
                            iu
                        } else {
                            iv
                        };
                        let y = if axis == 1 {
                            d
                        } else if u == 1 {
                            iu
                        } else {
                            iv
                        };
                        let z = if axis == 2 {
                            d
                        } else if u == 2 {
                            iu
                        } else {
                            iv
                        };

                        let block_value = get_voxel(x, y, z);
                        let block_present = VoxelDataUtils::is_block_present(block_value);
                        let block_is_preview = VoxelDataUtils::is_preview(block_value);
                        let block_is_selected = is_selected(block_value);
                        let block_type = VoxelDataUtils::get_block_type(block_value).max(1);

                        let nx = (x as i32) + if axis == 0 { *dir } else { 0 };
                        let ny = (y as i32) + if axis == 1 { *dir } else { 0 };
                        let nz = (z as i32) + if axis == 2 { *dir } else { 0 };
                        let neighbor_value = get_neighbor_block(nx, ny, nz);

                        if block_present {
                            let should_render_face = if block_is_preview {
                                !VoxelDataUtils::is_block_present(neighbor_value)
                                    || !VoxelDataUtils::is_preview(neighbor_value)
                            } else {
                                !VoxelDataUtils::is_block_present(neighbor_value)
                                    || VoxelDataUtils::is_preview(neighbor_value)
                            };

                            if should_render_face {
                                let texture_index =
                                    get_texture_index((block_type - 1) as usize, face_dir);

                                ao_mask[mask_index] = calculate_ambient_occlusion(
                                    nx,
                                    ny,
                                    nz,
                                    face_dir,
                                    &get_neighbor_block,
                                    preview_hidden,
                                );

                                if block_is_preview {
                                    preview_mask[mask_index] = texture_index as i16;
                                } else {
                                    real_mask[mask_index] = texture_index as i16;
                                }
                            }

                            if block_is_selected {
                                let neighbor_is_selected = is_selected(neighbor_value);
                                if !neighbor_is_selected {
                                    let texture_index =
                                        get_texture_index((block_type - 1) as usize, face_dir);
                                    selection_mask[mask_index] = texture_index as i16;
                                }
                            }
                        }
                    }
                }

                // Generate meshes
                generate_greedy_mesh(
                    &real_mask,
                    &ao_mask,
                    &mut processed,
                    u_size,
                    v_size,
                    d,
                    axis,
                    u,
                    v,
                    *dir,
                    face_dir,
                    texture_width,
                    real_mesh,
                    disable_greedy_meshing,
                );

                generate_greedy_mesh(
                    &preview_mask,
                    &ao_mask,
                    &mut processed,
                    u_size,
                    v_size,
                    d,
                    axis,
                    u,
                    v,
                    *dir,
                    face_dir,
                    texture_width,
                    preview_mesh,
                    disable_greedy_meshing,
                );

                generate_greedy_mesh(
                    &selection_mask,
                    &ao_mask,
                    &mut processed,
                    u_size,
                    v_size,
                    d,
                    axis,
                    u,
                    v,
                    *dir,
                    face_dir,
                    texture_width,
                    selection_mesh,
                    disable_greedy_meshing,
                );
            }
        }
    }
}
