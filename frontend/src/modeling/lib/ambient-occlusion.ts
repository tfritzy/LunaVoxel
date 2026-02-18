export const OCCLUSION_LEVELS = [1.0, 0.9, 0.85, 0.75];

const TANGENT_AXES: [number, number, number][] = [
  [1, 2, 0], // Face 0 (+X)
  [1, 2, 0], // Face 1 (-X)
  [0, 2, 1], // Face 2 (+Y)
  [0, 2, 1], // Face 3 (-Y)
  [0, 1, 2], // Face 4 (+Z)
  [0, 1, 2], // Face 5 (-Z)
];

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

export interface AoOffsets {
  offsets: Int32Array;
  uAxis: number;
  vAxis: number;
  nAxis: number;
}

export function precomputeAoOffsets(faceDir: number, strideX: number, dimZ: number): AoOffsets {
  const [uAxis, vAxis, nAxis] = TANGENT_AXES[faceDir];

  const axisStride = [strideX, dimZ, 1];
  const uStride = axisStride[uAxis];
  const vStride = axisStride[vAxis];

  const offsets = new Int32Array(8);
  offsets[0] = -uStride;
  offsets[1] = uStride;
  offsets[2] = -vStride;
  offsets[3] = vStride;
  offsets[4] = -uStride - vStride;
  offsets[5] = uStride - vStride;
  offsets[6] = -uStride + vStride;
  offsets[7] = uStride + vStride;

  return { offsets, uAxis, vAxis, nAxis };
}

export const calculateAmbientOcclusion = (
  nx: number,
  ny: number,
  nz: number,
  voxelData: Uint8Array,
  dimX: number,
  dimY: number,
  dimZ: number,
  centerIdx: number,
  aoOffsets: AoOffsets
): number => {
  const offsets = aoOffsets.offsets;
  const n = [nx, ny, nz];
  const dims = [dimX, dimY, dimZ];

  const nn = n[aoOffsets.nAxis];
  const dimN = dims[aoOffsets.nAxis];
  if (nn < 0 || nn >= dimN) {
    return 0;
  }

  const nu = n[aoOffsets.uAxis];
  const nv = n[aoOffsets.vAxis];
  const dimU = dims[aoOffsets.uAxis];
  const dimV = dims[aoOffsets.vAxis];

  const uNegOk = nu > 0;
  const uPosOk = nu < dimU - 1;
  const vNegOk = nv > 0;
  const vPosOk = nv < dimV - 1;

  const side1_neg = uNegOk && (voxelData[centerIdx + offsets[0]] & 0x7F) !== 0;
  const side1_pos = uPosOk && (voxelData[centerIdx + offsets[1]] & 0x7F) !== 0;
  const side2_neg = vNegOk && (voxelData[centerIdx + offsets[2]] & 0x7F) !== 0;
  const side2_pos = vPosOk && (voxelData[centerIdx + offsets[3]] & 0x7F) !== 0;

  const occ00 = (side1_neg && side2_neg) ? 3 :
    ((side1_neg ? 1 : 0) + (side2_neg ? 1 : 0) +
      ((uNegOk && vNegOk && (voxelData[centerIdx + offsets[4]] & 0x7F) !== 0) ? 1 : 0));
  const occ10 = (side1_pos && side2_neg) ? 3 :
    ((side1_pos ? 1 : 0) + (side2_neg ? 1 : 0) +
      ((uPosOk && vNegOk && (voxelData[centerIdx + offsets[5]] & 0x7F) !== 0) ? 1 : 0));
  const occ11 = (side1_pos && side2_pos) ? 3 :
    ((side1_pos ? 1 : 0) + (side2_pos ? 1 : 0) +
      ((uPosOk && vPosOk && (voxelData[centerIdx + offsets[7]] & 0x7F) !== 0) ? 1 : 0));
  const occ01 = (side1_neg && side2_pos) ? 3 :
    ((side1_neg ? 1 : 0) + (side2_pos ? 1 : 0) +
      ((uNegOk && vPosOk && (voxelData[centerIdx + offsets[6]] & 0x7F) !== 0) ? 1 : 0));

  return occ00 | (occ10 << 2) | (occ11 << 4) | (occ01 << 6);
};
