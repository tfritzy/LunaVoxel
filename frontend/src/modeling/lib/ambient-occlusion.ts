import { BlockModificationMode, BlockRun, MeshType } from "@/module_bindings";

const baseOffsets = {
  0: [
    [
      [1, -1, 0],
      [1, 0, -1],
      [1, -1, -1],
    ],
    [
      [1, 1, 0],
      [1, 0, -1],
      [1, 1, -1],
    ],
    [
      [1, 1, 0],
      [1, 0, 1],
      [1, 1, 1],
    ],
    [
      [1, -1, 0],
      [1, 0, 1],
      [1, -1, 1],
    ],
  ],

  1: [
    [
      [-1, -1, 0],
      [-1, 0, -1],
      [-1, -1, -1],
    ],
    [
      [-1, -1, 0],
      [-1, 0, 1],
      [-1, -1, 1],
    ],
    [
      [-1, 1, 0],
      [-1, 0, 1],
      [-1, 1, 1],
    ],
    [
      [-1, 1, 0],
      [-1, 0, -1],
      [-1, 1, -1],
    ],
  ],

  2: [
    [
      [-1, 1, 0],
      [0, 1, -1],
      [-1, 1, -1],
    ],
    [
      [-1, 1, 0],
      [0, 1, 1],
      [-1, 1, 1],
    ],
    [
      [1, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
    ],
    [
      [1, 1, 0],
      [0, 1, -1],
      [1, 1, -1],
    ],
  ],

  3: [
    [
      [-1, -1, 0],
      [0, -1, -1],
      [-1, -1, -1],
    ],
    [
      [1, -1, 0],
      [0, -1, -1],
      [1, -1, -1],
    ],
    [
      [1, -1, 0],
      [0, -1, 1],
      [1, -1, 1],
    ],
    [
      [-1, -1, 0],
      [0, -1, 1],
      [-1, -1, 1],
    ],
  ],

  4: [
    [
      [-1, 0, 1],
      [0, -1, 1],
      [-1, -1, 1],
    ],
    [
      [1, 0, 1],
      [0, -1, 1],
      [1, -1, 1],
    ],
    [
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
    [
      [-1, 0, 1],
      [0, 1, 1],
      [-1, 1, 1],
    ],
  ],

  5: [
    [
      [-1, 0, -1],
      [0, -1, -1],
      [-1, -1, -1],
    ],
    [
      [-1, 0, -1],
      [0, 1, -1],
      [-1, 1, -1],
    ],
    [
      [1, 0, -1],
      [0, 1, -1],
      [1, 1, -1],
    ],
    [
      [1, 0, -1],
      [0, -1, -1],
      [1, -1, -1],
    ],
  ],
};

const AO_CONFIG = {
  DISTANCE: 1,

  MAX_OCCLUSION: 0.85,
  SIDE_OCCLUSION_STRENGTH: 0.5,

  CORNER_WEIGHT: 1,
  SMOOTH_FALLOFF: true,

  VERTEX_AO_FALLOFF: 0.3,
  EDGE_BIAS: 0.7,
};

function generateAOLookup(distance: number = AO_CONFIG.DISTANCE) {
  const lookup: Record<number, number[][][]> = {};

  for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
    lookup[faceIndex] = [];

    for (let vertexIndex = 0; vertexIndex < 4; vertexIndex++) {
      const neighbors = calculateNeighborOffsets(
        faceIndex,
        vertexIndex,
        distance
      );
      lookup[faceIndex][vertexIndex] = neighbors;
    }
  }

  return lookup;
}

function isSolid(
  x: number,
  y: number,
  z: number,
  realBlocks: (BlockRun | undefined)[][][],
  previewBlocks: (MeshType | undefined)[][][],
  previewMode: BlockModificationMode
): boolean {
  if (!realBlocks[x]?.[y]?.[z]) {
    return false;
  } else {
    const hasRealBlock = !!realBlocks[x][y][z];

    const hasPreviewBlock = !!previewBlocks?.[x]?.[y]?.[z];
    const previewAffectsSolidity =
      hasPreviewBlock && previewMode.tag !== BlockModificationMode.Paint.tag;

    return hasRealBlock && !previewAffectsSolidity;
  }
}

function calculateNeighborOffsets(
  faceIndex: number,
  vertexIndex: number,
  distance: number
): number[][] {
  const baseOffset = baseOffsets[faceIndex][vertexIndex];
  return baseOffset.map((offset) => [
    offset[0] * distance,
    offset[1] * distance,
    offset[2] * distance,
  ]);
}

const AO_LOOKUP = generateAOLookup();

export function calculateVertexAOFast(
  blockX: number,
  blockY: number,
  blockZ: number,
  faceIndex: number,
  vertexIndex: number,
  realBlocks: (BlockRun | undefined)[][][],
  previewBlocks: (MeshType | undefined)[][][],
  previewMode: BlockModificationMode
): number {
  const checkPositions = AO_LOOKUP[faceIndex][vertexIndex];

  let side1 = false,
    side2 = false,
    corner = false;

  side1 = isSolid(
    blockX + checkPositions[0][0],
    blockY + checkPositions[0][1],
    blockZ + checkPositions[0][2],
    realBlocks,
    previewBlocks,
    previewMode
  );

  side2 = isSolid(
    blockX + checkPositions[1][0],
    blockY + checkPositions[1][1],
    blockZ + checkPositions[1][2],
    realBlocks,
    previewBlocks,
    previewMode
  );

  corner = isSolid(
    blockX + checkPositions[2][0],
    blockY + checkPositions[2][1],
    blockZ + checkPositions[2][2],
    realBlocks,
    previewBlocks,
    previewMode
  );

  let baseOcclusion = 0;

  if (side1 && side2) {
    baseOcclusion = 1.0 - AO_CONFIG.MAX_OCCLUSION;
  } else if (AO_CONFIG.SMOOTH_FALLOFF) {
    const sideCount = (side1 ? 1 : 0) + (side2 ? 1 : 0);
    const cornerContribution = corner ? AO_CONFIG.CORNER_WEIGHT : 0;
    baseOcclusion =
      (sideCount + cornerContribution) * AO_CONFIG.SIDE_OCCLUSION_STRENGTH;
  } else {
    const blockedCount =
      (side1 ? 1 : 0) +
      (side2 ? 1 : 0) +
      (corner ? AO_CONFIG.CORNER_WEIGHT : 0);
    baseOcclusion = blockedCount * AO_CONFIG.SIDE_OCCLUSION_STRENGTH;
  }

  const isCornerVertex = true;
  const vertexBias = isCornerVertex ? 1.0 : 1.0 - AO_CONFIG.VERTEX_AO_FALLOFF;

  const edgeFactor =
    AO_CONFIG.EDGE_BIAS + (1.0 - AO_CONFIG.EDGE_BIAS) * vertexBias;

  const finalOcclusion = baseOcclusion * edgeFactor;

  return Math.max(AO_CONFIG.MAX_OCCLUSION, 1.0 - finalOcclusion);
}
