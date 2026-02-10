import { VoxelFrame } from "./voxel-frame";
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

/**
 * Calculates ambient occlusion for a face
 * @returns packed occlusion mask with 2 bits per corner
 */
export const calculateAmbientOcclusion = (
  nx: number,
  ny: number,
  nz: number,
  faceDir: number,
  voxelData: ReadonlyArray<ReadonlyArray<Uint8Array>>,
  dimensions: Vector3,
  previewFrame: VoxelFrame,
  previewOccludes: boolean
): number => {
  // Get tangent vectors directly from the flat array for better performance
  const offset = faceDir * 6;
  const u0 = FACE_TANGENTS_FLAT[offset];
  const u1 = FACE_TANGENTS_FLAT[offset + 1];
  const u2 = FACE_TANGENTS_FLAT[offset + 2];
  const v0 = FACE_TANGENTS_FLAT[offset + 3];
  const v1 = FACE_TANGENTS_FLAT[offset + 4];
  const v2 = FACE_TANGENTS_FLAT[offset + 5];

  // Check if the voxel is far enough from edges to skip bounds checking
  const canSkipBoundsCheck = 
    nx > 0 && nx < dimensions.x - 1 &&
    ny > 0 && ny < dimensions.y - 1 &&
    nz > 0 && nz < dimensions.z - 1;

  const isOccluder = (x: number, y: number, z: number): boolean => {
    if (!canSkipBoundsCheck) {
      if (
        x < 0 ||
        x >= dimensions.x ||
        y < 0 ||
        y >= dimensions.y ||
        z < 0 ||
        z >= dimensions.z
      ) {
        return false;
      }
    }
    
    const val = voxelData[x][y][z];
    if (val > 0) return true;

    return previewOccludes && previewFrame.isSet(x, y, z);
  };

  const side1_neg = isOccluder(nx - u0, ny - u1, nz - u2);
  const side1_pos = isOccluder(nx + u0, ny + u1, nz + u2);
  const side2_neg = isOccluder(nx - v0, ny - v1, nz - v2);
  const side2_pos = isOccluder(nx + v0, ny + v1, nz + v2);

  const corner_nn = isOccluder(nx - u0 - v0, ny - u1 - v1, nz - u2 - v2);
  const corner_pn = isOccluder(nx + u0 - v0, ny + u1 - v1, nz + u2 - v2);
  const corner_np = isOccluder(nx - u0 + v0, ny - u1 + v1, nz - u2 + v2);
  const corner_pp = isOccluder(nx + u0 + v0, ny + u1 + v1, nz + u2 + v2);

  const calculateOcclusion = (s1: boolean, s2: boolean, c: boolean): number => {
    if (s1 && s2) {
      return 3; // Inner corner case
    }
    return (s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0);
  };

  const occ00 = calculateOcclusion(side1_neg, side2_neg, corner_nn);
  const occ10 = calculateOcclusion(side1_pos, side2_neg, corner_pn);
  const occ11 = calculateOcclusion(side1_pos, side2_pos, corner_pp);
  const occ01 = calculateOcclusion(side1_neg, side2_pos, corner_np);

  // Pack occlusion values directly (2 bits per corner)
  let occluderMask = 0;
  occluderMask |= occ00 << 0;
  occluderMask |= occ10 << 2;
  occluderMask |= occ11 << 4;
  occluderMask |= occ01 << 6;

  return occluderMask;
};
