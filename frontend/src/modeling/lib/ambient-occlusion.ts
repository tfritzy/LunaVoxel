/**
 * Defines the final AO value based on the number of occluders.
 * Index 0 = 0 occluders (fully lit, should be 1.0)
 * Index 1 = 1 occluder
 * Index 2 = 2 occluders
 * Index 3 = 3 occluders (or a sharp interior corner)
 */
export const OCCLUSION_LEVELS = [1.0, 0.9, 0.85, 0.75];

// Tangent directions for each face - controls where we check for occluding blocks
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
  getNeighborBlock: (x: number, y: number, z: number) => number | null
): number => {
  const tangent = FACE_TANGENTS[faceDir];
  const u_dir = [tangent.u[0], tangent.u[1], tangent.u[2]];
  const v_dir = [tangent.v[0], tangent.v[1], tangent.v[2]];

  const isOccluder = (ox: number, oy: number, oz: number): boolean => {
    const val = getNeighborBlock(nx + ox, ny + oy, nz + oz);
    return val !== null && val !== 0;
  };

  const side1_neg = isOccluder(-u_dir[0], -u_dir[1], -u_dir[2]);
  const side1_pos = isOccluder(u_dir[0], u_dir[1], u_dir[2]);
  const side2_neg = isOccluder(-v_dir[0], -v_dir[1], -v_dir[2]);
  const side2_pos = isOccluder(v_dir[0], v_dir[1], v_dir[2]);

  const corner_nn = isOccluder(
    -u_dir[0] - v_dir[0],
    -u_dir[1] - v_dir[1],
    -u_dir[2] - v_dir[2]
  );
  const corner_pn = isOccluder(
    u_dir[0] - v_dir[0],
    u_dir[1] - v_dir[1],
    u_dir[2] - v_dir[2]
  );
  const corner_np = isOccluder(
    -u_dir[0] + v_dir[0],
    -u_dir[1] + v_dir[1],
    -u_dir[2] + v_dir[2]
  );
  const corner_pp = isOccluder(
    u_dir[0] + v_dir[0],
    u_dir[1] + v_dir[1],
    u_dir[2] + v_dir[2]
  );

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
