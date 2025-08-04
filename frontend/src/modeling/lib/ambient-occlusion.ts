import { BlockModificationMode } from "@/module_bindings";
import { Block } from "./blocks";

type FaceOffsets = {
  [faceIndex: number]: [number, number, number][][];
};

const baseOffsets: FaceOffsets = {
  // Face 0: Right (+X) - vertices: top-back, top-front, bottom-front, bottom-back
  0: [
    // Vertex 0: top-back [0.49999, 0.49999, -0.49999]
    [
      [1, 1, 0], // side1: up
      [1, 0, -1], // side2: back
      [1, 1, -1], // corner: up-back
    ],
    // Vertex 1: top-front [0.49999, 0.49999, 0.49999]
    [
      [1, 1, 0], // side1: up
      [1, 0, 1], // side2: front
      [1, 1, 1], // corner: up-front
    ],
    // Vertex 2: bottom-front [0.49999, -0.49999, 0.49999]
    [
      [1, -1, 0], // side1: down
      [1, 0, 1], // side2: front
      [1, -1, 1], // corner: down-front
    ],
    // Vertex 3: bottom-back [0.49999, -0.49999, -0.49999]
    [
      [1, -1, 0], // side1: down
      [1, 0, -1], // side2: back
      [1, -1, -1], // corner: down-back
    ],
  ],

  // Face 1: Left (-X) - vertices: top-front, top-back, bottom-back, bottom-front
  1: [
    // Vertex 0: top-front [-0.49999, 0.49999, 0.49999]
    [
      [-1, 1, 0], // side1: up
      [-1, 0, 1], // side2: front
      [-1, 1, 1], // corner: up-front
    ],
    // Vertex 1: top-back [-0.49999, 0.49999, -0.49999]
    [
      [-1, 1, 0], // side1: up
      [-1, 0, -1], // side2: back
      [-1, 1, -1], // corner: up-back
    ],
    // Vertex 2: bottom-back [-0.49999, -0.49999, -0.49999]
    [
      [-1, -1, 0], // side1: down
      [-1, 0, -1], // side2: back
      [-1, -1, -1], // corner: down-back
    ],
    // Vertex 3: bottom-front [-0.49999, -0.49999, 0.49999]
    [
      [-1, -1, 0], // side1: down
      [-1, 0, 1], // side2: front
      [-1, -1, 1], // corner: down-front
    ],
  ],

  // Face 2: Top (+Y) - vertices: back-left, front-left, front-right, back-right
  2: [
    // Vertex 0: back-left [-0.49999, 0.49999, -0.49999]
    [
      [-1, 1, 0], // side1: left
      [0, 1, -1], // side2: back
      [-1, 1, -1], // corner: left-back
    ],
    // Vertex 1: front-left [-0.49999, 0.49999, 0.49999]
    [
      [-1, 1, 0], // side1: left
      [0, 1, 1], // side2: front
      [-1, 1, 1], // corner: left-front
    ],
    // Vertex 2: front-right [0.49999, 0.49999, 0.49999]
    [
      [1, 1, 0], // side1: right
      [0, 1, 1], // side2: front
      [1, 1, 1], // corner: right-front
    ],
    // Vertex 3: back-right [0.49999, 0.49999, -0.49999]
    [
      [1, 1, 0], // side1: right
      [0, 1, -1], // side2: back
      [1, 1, -1], // corner: right-back
    ],
  ],

  // Face 3: Bottom (-Y) - vertices: front-left, back-left, back-right, front-right
  3: [
    // Vertex 0: front-left [-0.49999, -0.49999, 0.49999]
    [
      [-1, -1, 0], // side1: left
      [0, -1, 1], // side2: front
      [-1, -1, 1], // corner: left-front
    ],
    // Vertex 1: back-left [-0.49999, -0.49999, -0.49999]
    [
      [-1, -1, 0], // side1: left
      [0, -1, -1], // side2: back
      [-1, -1, -1], // corner: left-back
    ],
    // Vertex 2: back-right [0.49999, -0.49999, -0.49999]
    [
      [1, -1, 0], // side1: right
      [0, -1, -1], // side2: back
      [1, -1, -1], // corner: right-back
    ],
    // Vertex 3: front-right [0.49999, -0.49999, 0.49999]
    [
      [1, -1, 0], // side1: right
      [0, -1, 1], // side2: front
      [1, -1, 1], // corner: right-front
    ],
  ],

  // Face 4: Front (+Z) - vertices: top-right, top-left, bottom-left, bottom-right
  4: [
    // Vertex 0: top-right [0.49999, 0.49999, 0.49999]
    [
      [1, 0, 1], // side1: right
      [0, 1, 1], // side2: up
      [1, 1, 1], // corner: right-up
    ],
    // Vertex 1: top-left [-0.49999, 0.49999, 0.49999]
    [
      [-1, 0, 1], // side1: left
      [0, 1, 1], // side2: up
      [-1, 1, 1], // corner: left-up
    ],
    // Vertex 2: bottom-left [-0.49999, -0.49999, 0.49999]
    [
      [-1, 0, 1], // side1: left
      [0, -1, 1], // side2: down
      [-1, -1, 1], // corner: left-down
    ],
    // Vertex 3: bottom-right [0.49999, -0.49999, 0.49999]
    [
      [1, 0, 1], // side1: right
      [0, -1, 1], // side2: down
      [1, -1, 1], // corner: right-down
    ],
  ],

  // Face 5: Back (-Z) - vertices: top-left, top-right, bottom-right, bottom-left
  5: [
    // Vertex 0: top-left [-0.49999, 0.49999, -0.49999]
    [
      [-1, 0, -1], // side1: left
      [0, 1, -1], // side2: up
      [-1, 1, -1], // corner: left-up
    ],
    // Vertex 1: top-right [0.49999, 0.49999, -0.49999]
    [
      [1, 0, -1], // side1: right
      [0, 1, -1], // side2: up
      [1, 1, -1], // corner: right-up
    ],
    // Vertex 2: bottom-right [0.49999, -0.49999, -0.49999]
    [
      [1, 0, -1], // side1: right
      [0, -1, -1], // side2: down
      [1, -1, -1], // corner: right-down
    ],
    // Vertex 3: bottom-left [-0.49999, -0.49999, -0.49999]
    [
      [-1, 0, -1], // side1: left
      [0, -1, -1], // side2: down
      [-1, -1, -1], // corner: left-down
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
  OCCLUSION_LEVELS: [1.0, 0.92, 0.88, 0.82],
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
  return baseOffset.map((offset: [number, number, number]) => [
    offset[0] * distance,
    offset[1] * distance,
    offset[2] * distance,
  ]);
}

const AO_LOOKUP = generateAOLookup();
export const calculateVertexAO = (
  blockX: number,
  blockY: number,
  blockZ: number,
  faceIndex: number,
  vertexIndex: number,
  realBlocks: (Block | undefined)[][][],
  previewBlocks: (Block | undefined)[][][],
  previewMode: BlockModificationMode
): number => {
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
};