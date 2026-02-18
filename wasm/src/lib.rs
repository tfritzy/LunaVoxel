mod ambient_occlusion;
mod find_exterior_faces;
mod mesh_arrays;
mod texture_coords;
mod voxel_constants;

use find_exterior_faces::ExteriorFacesFinder;
use mesh_arrays::MeshArrays;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmExteriorFacesFinder {
    finder: ExteriorFacesFinder,
    mesh_arrays: Option<MeshArrays>,
}

#[wasm_bindgen]
impl WasmExteriorFacesFinder {
    #[wasm_bindgen(constructor)]
    pub fn new(max_dimension: usize) -> Self {
        Self {
            finder: ExteriorFacesFinder::new(max_dimension),
            mesh_arrays: None,
        }
    }

    #[wasm_bindgen(js_name = findExteriorFaces)]
    pub fn find_exterior_faces(
        &mut self,
        voxel_data: &[u8],
        texture_width: i32,
        block_atlas_mapping: &[i32],
        dim_x: usize,
        dim_y: usize,
        dim_z: usize,
        max_vertices: usize,
        max_indices: usize,
        selection_data: &[u8],
        selection_dim_x: usize,
        selection_dim_y: usize,
        selection_dim_z: usize,
        selection_empty: bool,
    ) {
        let mesh_arrays = self.mesh_arrays.get_or_insert_with(|| {
            MeshArrays::new(max_vertices, max_indices)
        });

        let needs_resize = mesh_arrays.vertices.len() < max_vertices * 3
            || mesh_arrays.indices.len() < max_indices;

        if needs_resize {
            *mesh_arrays = MeshArrays::new(max_vertices, max_indices);
        }

        self.finder.find_exterior_faces(
            voxel_data,
            texture_width,
            block_atlas_mapping,
            dim_x,
            dim_y,
            dim_z,
            self.mesh_arrays.as_mut().unwrap(),
            selection_data,
            selection_dim_x,
            selection_dim_y,
            selection_dim_z,
            selection_empty,
        );
    }

    #[wasm_bindgen(js_name = getVertexCount)]
    pub fn get_vertex_count(&self) -> usize {
        self.mesh_arrays
            .as_ref()
            .map_or(0, |m| m.vertex_count)
    }

    #[wasm_bindgen(js_name = getIndexCount)]
    pub fn get_index_count(&self) -> usize {
        self.mesh_arrays
            .as_ref()
            .map_or(0, |m| m.index_count)
    }

    #[wasm_bindgen(js_name = getVertices)]
    pub fn get_vertices(&self) -> Vec<f32> {
        self.mesh_arrays.as_ref().map_or_else(Vec::new, |m| {
            m.vertices[..m.vertex_count * 3].to_vec()
        })
    }

    #[wasm_bindgen(js_name = getNormals)]
    pub fn get_normals(&self) -> Vec<f32> {
        self.mesh_arrays.as_ref().map_or_else(Vec::new, |m| {
            m.normals[..m.vertex_count * 3].to_vec()
        })
    }

    #[wasm_bindgen(js_name = getUVs)]
    pub fn get_uvs(&self) -> Vec<f32> {
        self.mesh_arrays.as_ref().map_or_else(Vec::new, |m| {
            m.uvs[..m.vertex_count * 2].to_vec()
        })
    }

    #[wasm_bindgen(js_name = getAO)]
    pub fn get_ao(&self) -> Vec<f32> {
        self.mesh_arrays.as_ref().map_or_else(Vec::new, |m| {
            m.ao[..m.vertex_count].to_vec()
        })
    }

    #[wasm_bindgen(js_name = getIsSelected)]
    pub fn get_is_selected(&self) -> Vec<f32> {
        self.mesh_arrays.as_ref().map_or_else(Vec::new, |m| {
            m.is_selected[..m.vertex_count].to_vec()
        })
    }

    #[wasm_bindgen(js_name = getIndices)]
    pub fn get_indices(&self) -> Vec<u32> {
        self.mesh_arrays.as_ref().map_or_else(Vec::new, |m| {
            m.indices[..m.index_count].to_vec()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_voxel_data(dim_x: usize, dim_y: usize, dim_z: usize) -> Vec<u8> {
        vec![0u8; dim_x * dim_y * dim_z]
    }

    fn set_voxel(
        data: &mut [u8],
        x: usize,
        y: usize,
        z: usize,
        block_type: u8,
        dim_y: usize,
        dim_z: usize,
    ) {
        data[x * dim_y * dim_z + y * dim_z + z] = block_type;
    }

    fn create_block_atlas_mapping(num_blocks: usize) -> Vec<i32> {
        (0..num_blocks as i32).collect()
    }

    fn run_finder(
        voxel_data: &[u8],
        dim_x: usize,
        dim_y: usize,
        dim_z: usize,
        block_atlas_mapping: &[i32],
        selection_data: &[u8],
        selection_empty: bool,
    ) -> (usize, usize) {
        let max_dim = dim_x.max(dim_y).max(dim_z);
        let mut finder = ExteriorFacesFinder::new(max_dim);
        let total_voxels = dim_x * dim_y * dim_z;
        let max_faces = total_voxels * 6;
        let mut mesh_arrays = MeshArrays::new(max_faces * 4, max_faces * 6);

        finder.find_exterior_faces(
            voxel_data,
            4,
            block_atlas_mapping,
            dim_x,
            dim_y,
            dim_z,
            &mut mesh_arrays,
            selection_data,
            dim_x,
            dim_y,
            dim_z,
            selection_empty,
        );

        (mesh_arrays.vertex_count, mesh_arrays.index_count)
    }

    #[test]
    fn single_block_6_faces() {
        let (dx, dy, dz) = (1, 1, 1);
        let mut data = create_voxel_data(dx, dy, dz);
        set_voxel(&mut data, 0, 0, 0, 1, dy, dz);
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 36);
        assert_eq!(vc, 24);
    }

    #[test]
    fn solid_2x2x2_cube() {
        let (dx, dy, dz) = (2, 2, 2);
        let mut data = create_voxel_data(dx, dy, dz);
        for x in 0..2 {
            for y in 0..2 {
                for z in 0..2 {
                    set_voxel(&mut data, x, y, z, 1, dy, dz);
                }
            }
        }
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 36);
        assert_eq!(vc, 24);
    }

    #[test]
    fn cube_3x3x3_with_hole() {
        let (dx, dy, dz) = (3, 3, 3);
        let mut data = create_voxel_data(dx, dy, dz);
        for x in 0..3 {
            for y in 0..3 {
                for z in 0..3 {
                    let is_on_surface =
                        x == 0 || x == 2 || y == 0 || y == 2 || z == 0 || z == 2;
                    let is_hole = z == 0 && x == 1 && y == 1;
                    if is_on_surface && !is_hole {
                        set_voxel(&mut data, x, y, z, 1, dy, dz);
                    }
                }
            }
        }
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 108);
        assert_eq!(vc, 72);
        assert_eq!(ic % 6, 0);
        assert_eq!(vc % 4, 0);
    }

    #[test]
    fn empty_voxel_data() {
        let (dx, dy, dz) = (2, 2, 2);
        let data = create_voxel_data(dx, dy, dz);
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 0);
        assert_eq!(vc, 0);
    }

    #[test]
    fn two_adjacent_blocks() {
        let (dx, dy, dz) = (2, 1, 1);
        let mut data = create_voxel_data(dx, dy, dz);
        set_voxel(&mut data, 0, 0, 0, 1, dy, dz);
        set_voxel(&mut data, 1, 0, 0, 1, dy, dz);
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 36);
        assert_eq!(vc, 24);
    }

    #[test]
    fn two_adjacent_blocks_different_types() {
        let (dx, dy, dz) = (2, 1, 1);
        let mut data = create_voxel_data(dx, dy, dz);
        set_voxel(&mut data, 0, 0, 0, 1, dy, dz);
        set_voxel(&mut data, 1, 0, 0, 2, dy, dz);
        let mapping = create_block_atlas_mapping(3);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 60);
        assert_eq!(vc, 40);
    }

    #[test]
    fn selection_faces_marked() {
        let (dx, dy, dz) = (2, 1, 1);
        let data = create_voxel_data(dx, dy, dz);
        let mapping = create_block_atlas_mapping(2);
        let mut sel = vec![0u8; dx * dy * dz];
        sel[0] = 1; // Set selection at (0,0,0)

        let max_dim = dx.max(dy).max(dz);
        let mut finder = ExteriorFacesFinder::new(max_dim);
        let total_voxels = dx * dy * dz;
        let max_faces = total_voxels * 6;
        let mut mesh_arrays = MeshArrays::new(max_faces * 4, max_faces * 6);

        finder.find_exterior_faces(
            &data,
            4,
            &mapping,
            dx,
            dy,
            dz,
            &mut mesh_arrays,
            &sel,
            dx,
            dy,
            dz,
            false,
        );

        assert_eq!(mesh_arrays.index_count, 36);
        assert_eq!(mesh_arrays.vertex_count, 24);

        for i in 0..mesh_arrays.vertex_count {
            assert_eq!(mesh_arrays.is_selected[i], 1.0);
        }
    }

    #[test]
    fn non_selected_faces_not_marked() {
        let (dx, dy, dz) = (2, 1, 1);
        let mut data = create_voxel_data(dx, dy, dz);
        set_voxel(&mut data, 0, 0, 0, 1, dy, dz);
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let max_dim = dx.max(dy).max(dz);
        let mut finder = ExteriorFacesFinder::new(max_dim);
        let total_voxels = dx * dy * dz;
        let max_faces = total_voxels * 6;
        let mut mesh_arrays = MeshArrays::new(max_faces * 4, max_faces * 6);

        finder.find_exterior_faces(
            &data,
            4,
            &mapping,
            dx,
            dy,
            dz,
            &mut mesh_arrays,
            &sel,
            dx,
            dy,
            dz,
            true,
        );

        assert_eq!(mesh_arrays.index_count, 36);
        assert_eq!(mesh_arrays.vertex_count, 24);

        for i in 0..mesh_arrays.vertex_count {
            assert_eq!(mesh_arrays.is_selected[i], 0.0);
        }
    }

    #[test]
    fn solid_8x8x8_cube() {
        let (dx, dy, dz) = (8, 8, 8);
        let mut data = create_voxel_data(dx, dy, dz);
        for x in 0..8 {
            for y in 0..8 {
                for z in 0..8 {
                    set_voxel(&mut data, x, y, z, 1, dy, dz);
                }
            }
        }
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 36);
        assert_eq!(vc, 24);
    }

    #[test]
    fn erase_preview_no_faces() {
        let (dx, dy, dz) = (1, 1, 1);
        let mut data = create_voxel_data(dx, dy, dz);
        set_voxel(&mut data, 0, 0, 0, 0x80, dy, dz); // RAYCASTABLE_BIT only
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 0);
        assert_eq!(vc, 0);
    }

    #[test]
    fn attach_preview_toward_erase() {
        let (dx, dy, dz) = (2, 1, 1);
        let mut data = create_voxel_data(dx, dy, dz);
        set_voxel(&mut data, 0, 0, 0, 1, dy, dz);
        set_voxel(&mut data, 1, 0, 0, 0x80, dy, dz); // RAYCASTABLE_BIT
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 36);
        assert_eq!(vc, 24);
    }

    #[test]
    fn attach_preview_surrounded_by_erase() {
        let (dx, dy, dz) = (3, 3, 3);
        let mut data = create_voxel_data(dx, dy, dz);
        for x in 0..3 {
            for y in 0..3 {
                for z in 0..3 {
                    if x == 1 && y == 1 && z == 1 {
                        set_voxel(&mut data, x, y, z, 1, dy, dz);
                    } else {
                        set_voxel(&mut data, x, y, z, 0x80, dy, dz); // RAYCASTABLE_BIT
                    }
                }
            }
        }
        let mapping = create_block_atlas_mapping(2);
        let sel = vec![0u8; dx * dy * dz];

        let (vc, ic) = run_finder(&data, dx, dy, dz, &mapping, &sel, true);
        assert_eq!(ic, 36);
        assert_eq!(vc, 24);
    }
}
