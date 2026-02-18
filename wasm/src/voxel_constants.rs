pub struct FaceData {
    pub normal: [f32; 3],
}

pub const FACES: [FaceData; 6] = [
    FaceData { normal: [1.0, 0.0, 0.0] },   // +X
    FaceData { normal: [-1.0, 0.0, 0.0] },   // -X
    FaceData { normal: [0.0, 1.0, 0.0] },    // +Y
    FaceData { normal: [0.0, -1.0, 0.0] },   // -Y
    FaceData { normal: [0.0, 0.0, 1.0] },    // +Z
    FaceData { normal: [0.0, 0.0, -1.0] },   // -Z
];
