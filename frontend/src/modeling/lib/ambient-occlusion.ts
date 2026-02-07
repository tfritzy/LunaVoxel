/**
 * Brightness multipliers indexed by occluder count (0-3).
 */
export const OCCLUSION_LEVELS = [1.0, 0.9, 0.85, 0.75];

/**
 * Tangent vectors per face index used to sample neighboring voxels for AO.
 * Each tangent must have exactly one non-zero component for axis resolution.
 */
export const FACE_TANGENTS: { u: [number, number, number]; v: [number, number, number] }[] = [
  { u: [0, 1, 0], v: [0, 0, 1] }, // +X
  { u: [0, 1, 0], v: [0, 0, 1] }, // -X
  { u: [1, 0, 0], v: [0, 0, 1] }, // +Y
  { u: [1, 0, 0], v: [0, 0, 1] }, // -Y
  { u: [1, 0, 0], v: [0, 1, 0] }, // +Z
  { u: [1, 0, 0], v: [0, 1, 0] }, // -Z
];

/**
 * Compute AO level (0-3) from two side occluders and the corner occluder.
 */
export const calculateOcclusionLevel = (
  side1: boolean,
  side2: boolean,
  corner: boolean
): number => {
  if (side1 && side2) {
    return 3;
  }
  return (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
};
