import { BlockModificationMode } from "@/module_bindings";
import { Block } from "./blocks";

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
  /** The distance in blocks to check for occluders. */
  DISTANCE: 1,

  /**
   * Defines the final AO value based on the number of occluders.
   * Index 0 = 0 occluders (fully lit, should be 1.0)
   * Index 1 = 1 occluder
   * Index 2 = 2 occluders
   * Index 3 = 3 occluders (or a sharp interior corner)
   */
  OCCLUSION_LEVELS: [1.0, 0.95, 0.92, 0.88],
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
  realBlocks: (Block | undefined)[][][],
  previewBlocks: (Block | undefined)[][][],
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
export function calculateVertexAO(
  blockX: number,
  blockY: number,
  blockZ: number,
  faceIndex: number,
  vertexIndex: number,
  realBlocks: (Block | undefined)[][][],
  previewBlocks: (Block | undefined)[][][],
  previewMode: BlockModificationMode
): number {
  const checkPositions = AO_LOOKUP[faceIndex][vertexIndex];
  const side1Pos = checkPositions[0];
  const side2Pos = checkPositions[1];
  const cornerPos = checkPositions[2];

  const side1Occluded = isSolid(
    blockX + side1Pos[0],
    blockY + side1Pos[1],
    blockZ + side1Pos[2],
    realBlocks,
    previewBlocks,
    previewMode
  );

  const side2Occluded = isSolid(
    blockX + side2Pos[0],
    blockY + side2Pos[1],
    blockZ + side2Pos[2],
    realBlocks,
    previewBlocks,
    previewMode
  );

  const cornerOccluded = isSolid(
    blockX + cornerPos[0],
    blockY + cornerPos[1],
    blockZ + cornerPos[2],
    realBlocks,
    previewBlocks,
    previewMode
  );

  // The special case for sharp corners maps to the darkest occlusion level.
  if (side1Occluded && side2Occluded) {
    return AO_CONFIG.OCCLUSION_LEVELS[3];
  }

  // Count the total number of occluding blocks.
  let occluderCount = 0;
  if (side1Occluded) occluderCount++;
  if (side2Occluded) occluderCount++;
  if (cornerOccluded) occluderCount++;

  // Return the AO value from the lookup table.
  return AO_CONFIG.OCCLUSION_LEVELS[occluderCount];
}
