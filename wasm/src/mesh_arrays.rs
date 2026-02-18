pub struct MeshArrays {
    pub vertices: Vec<f32>,
    pub normals: Vec<f32>,
    pub uvs: Vec<f32>,
    pub ao: Vec<f32>,
    pub is_selected: Vec<f32>,
    pub indices: Vec<u32>,
    pub vertex_count: usize,
    pub index_count: usize,
}

impl MeshArrays {
    pub fn new(max_vertices: usize, max_indices: usize) -> Self {
        Self {
            vertices: vec![0.0; max_vertices * 3],
            normals: vec![0.0; max_vertices * 3],
            uvs: vec![0.0; max_vertices * 2],
            ao: vec![0.0; max_vertices],
            is_selected: vec![0.0; max_vertices],
            indices: vec![0; max_indices],
            vertex_count: 0,
            index_count: 0,
        }
    }

    pub fn reset(&mut self) {
        self.vertex_count = 0;
        self.index_count = 0;
    }

    #[inline(always)]
    pub fn push_vertex(&mut self, x: f32, y: f32, z: f32) {
        let offset = self.vertex_count * 3;
        self.vertices[offset] = x;
        self.vertices[offset + 1] = y;
        self.vertices[offset + 2] = z;
    }

    #[inline(always)]
    pub fn push_normal(&mut self, x: f32, y: f32, z: f32) {
        let offset = self.vertex_count * 3;
        self.normals[offset] = x;
        self.normals[offset + 1] = y;
        self.normals[offset + 2] = z;
    }

    #[inline(always)]
    pub fn push_uv(&mut self, u: f32, v: f32) {
        let offset = self.vertex_count * 2;
        self.uvs[offset] = u;
        self.uvs[offset + 1] = v;
    }

    #[inline(always)]
    pub fn push_ao(&mut self, value: f32) {
        self.ao[self.vertex_count] = value;
    }

    #[inline(always)]
    pub fn push_is_selected(&mut self, value: u8) {
        self.is_selected[self.vertex_count] = value as f32;
    }

    #[inline(always)]
    pub fn increment_vertex(&mut self) {
        self.vertex_count += 1;
    }

    #[inline(always)]
    pub fn push_index(&mut self, index: u32) {
        self.indices[self.index_count] = index;
        self.index_count += 1;
    }
}
