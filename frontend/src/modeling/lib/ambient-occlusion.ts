import { VoxelFrame } from "./voxel-frame";
import { Vector3 } from "@/module_bindings";

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
  voxelData: Uint8Array[][],
  dimensions: Vector3,
  previewFrame: VoxelFrame,
  previewOccludes: boolean
): number => {
  const tangent = FACE_TANGENTS[faceDir];
  
  // Get tangent vectors directly from the tangent object
  const u0 = tangent.u[0];
  const u1 = tangent.u[1];
  const u2 = tangent.u[2];
  const v0 = tangent.v[0];
  const v1 = tangent.v[1];
  const v2 = tangent.v[2];

  // Pre-calculate the 8 neighbor positions
  const side1_neg_x = nx - u0;
  const side1_neg_y = ny - u1;
  const side1_neg_z = nz - u2;
  
  const side1_pos_x = nx + u0;
  const side1_pos_y = ny + u1;
  const side1_pos_z = nz + u2;
  
  const side2_neg_x = nx - v0;
  const side2_neg_y = ny - v1;
  const side2_neg_z = nz - v2;
  
  const side2_pos_x = nx + v0;
  const side2_pos_y = ny + v1;
  const side2_pos_z = nz + v2;
  
  const corner_nn_x = nx - u0 - v0;
  const corner_nn_y = ny - u1 - v1;
  const corner_nn_z = nz - u2 - v2;
  
  const corner_pn_x = nx + u0 - v0;
  const corner_pn_y = ny + u1 - v1;
  const corner_pn_z = nz + u2 - v2;
  
  const corner_np_x = nx - u0 + v0;
  const corner_np_y = ny - u1 + v1;
  const corner_np_z = nz - u2 + v2;
  
  const corner_pp_x = nx + u0 + v0;
  const corner_pp_y = ny + u1 + v1;
  const corner_pp_z = nz + u2 + v2;

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

  const side1_neg = isOccluder(side1_neg_x, side1_neg_y, side1_neg_z);
  const side1_pos = isOccluder(side1_pos_x, side1_pos_y, side1_pos_z);
  const side2_neg = isOccluder(side2_neg_x, side2_neg_y, side2_neg_z);
  const side2_pos = isOccluder(side2_pos_x, side2_pos_y, side2_pos_z);

  const corner_nn = isOccluder(corner_nn_x, corner_nn_y, corner_nn_z);
  const corner_pn = isOccluder(corner_pn_x, corner_pn_y, corner_pn_z);
  const corner_np = isOccluder(corner_np_x, corner_np_y, corner_np_z);
  const corner_pp = isOccluder(corner_pp_x, corner_pp_y, corner_pp_z);

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
