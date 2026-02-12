import type { Vector3 } from "@/state/types";

/**
 * Defines the final AO value based on the number of occluders.
 * Index 0 = 0 occluders (fully lit, should be 1.0)
 * Index 1 = 1 occluder
 * Index 2 = 2 occluders
 * Index 3 = 3 occluders (or a sharp interior corner)
 */
export const OCCLUSION_LEVELS = [1.0, 0.9, 0.85, 0.75];

// Tangent directions for each face - controls where we check for occluding blocks
// Stored as flat Int8Array for better performance: [u0, u1, u2, v0, v1, v2] per face
export const FACE_TANGENTS_FLAT = new Int8Array([
  0, 1, 0, 0, 0, 1, // Face 0 (+X): u=[0,1,0], v=[0,0,1]
  0, 1, 0, 0, 0, 1, // Face 1 (-X): u=[0,1,0], v=[0,0,1]
  1, 0, 0, 0, 0, 1, // Face 2 (+Y): u=[1,0,0], v=[0,0,1]
  1, 0, 0, 0, 0, 1, // Face 3 (-Y): u=[1,0,0], v=[0,0,1]
  1, 0, 0, 0, 1, 0, // Face 4 (+Z): u=[1,0,0], v=[0,1,0]
  1, 0, 0, 0, 1, 0, // Face 5 (-Z): u=[1,0,0], v=[0,1,0]
]);

// Legacy export for backward compatibility
export const FACE_TANGENTS: {
  [key: number]: { u: [number, number, number]; v: [number, number, number] };
} = {
  0: { u: [0, 1, 0], v: [0, 0, 1] }, // +X face: check Y and Z directions
  1: { u: [0, 1, 0], v: [0, 0, 1] }, // -X face: check Y and Z directions
  2: { u: [1, 0, 0], v: [0, 0, 1] }, // +Y face: check X and Z directions
  3: { u: [1, 0, 0], v: [0, 0, 1] }, // -Y face: check X and Z directions
  4: { u: [1, 0, 0], v: [0, 1, 0] }, // +Z face: check X and Y directions
  5: { u: [1, 0, 0], v: [0, 1, 0] }, // -Z face: check X and Y directions
};

function isOccluderAt(
  x: number, y: number, z: number,
  voxelData: Uint8Array,
  dimX: number, dimY: number, dimZ: number,
  strideX: number
): boolean {
  if (x < 0 || x >= dimX || y < 0 || y >= dimY || z < 0 || z >= dimZ) {
    return false;
  }
  return (voxelData[x * strideX + y * dimZ + z] & 0x7F) !== 0;
}

export const calculateAmbientOcclusion = (
  nx: number,
  ny: number,
  nz: number,
  faceDir: number,
  voxelData: Uint8Array,
  dimensions: Vector3
): number => {
  const offset = faceDir * 6;
  const u0 = FACE_TANGENTS_FLAT[offset];
  const u1 = FACE_TANGENTS_FLAT[offset + 1];
  const u2 = FACE_TANGENTS_FLAT[offset + 2];
  const v0 = FACE_TANGENTS_FLAT[offset + 3];
  const v1 = FACE_TANGENTS_FLAT[offset + 4];
  const v2 = FACE_TANGENTS_FLAT[offset + 5];

  const dimX = dimensions.x;
  const dimY = dimensions.y;
  const dimZ = dimensions.z;
  const strideX = dimY * dimZ;

  const side1_neg = isOccluderAt(nx - u0, ny - u1, nz - u2, voxelData, dimX, dimY, dimZ, strideX);
  const side1_pos = isOccluderAt(nx + u0, ny + u1, nz + u2, voxelData, dimX, dimY, dimZ, strideX);
  const side2_neg = isOccluderAt(nx - v0, ny - v1, nz - v2, voxelData, dimX, dimY, dimZ, strideX);
  const side2_pos = isOccluderAt(nx + v0, ny + v1, nz + v2, voxelData, dimX, dimY, dimZ, strideX);

  const corner_nn = isOccluderAt(nx - u0 - v0, ny - u1 - v1, nz - u2 - v2, voxelData, dimX, dimY, dimZ, strideX);
  const corner_pn = isOccluderAt(nx + u0 - v0, ny + u1 - v1, nz + u2 - v2, voxelData, dimX, dimY, dimZ, strideX);
  const corner_np = isOccluderAt(nx - u0 + v0, ny - u1 + v1, nz - u2 + v2, voxelData, dimX, dimY, dimZ, strideX);
  const corner_pp = isOccluderAt(nx + u0 + v0, ny + u1 + v1, nz + u2 + v2, voxelData, dimX, dimY, dimZ, strideX);

  const occ00 = (side1_neg && side2_neg) ? 3 : ((side1_neg ? 1 : 0) + (side2_neg ? 1 : 0) + (corner_nn ? 1 : 0));
  const occ10 = (side1_pos && side2_neg) ? 3 : ((side1_pos ? 1 : 0) + (side2_neg ? 1 : 0) + (corner_pn ? 1 : 0));
  const occ11 = (side1_pos && side2_pos) ? 3 : ((side1_pos ? 1 : 0) + (side2_pos ? 1 : 0) + (corner_pp ? 1 : 0));
  const occ01 = (side1_neg && side2_pos) ? 3 : ((side1_neg ? 1 : 0) + (side2_pos ? 1 : 0) + (corner_np ? 1 : 0));

  return occ00 | (occ10 << 2) | (occ11 << 4) | (occ01 << 6);
};
