import { Atlas, BlockModificationMode, ProjectBlocks } from "@/module_bindings";
import * as THREE from "three";
import { VoxelFaces } from "./layer-mesh";
import { Block } from "./blocks";

export const findExteriorFaces = (
  realBlocks: (Block | undefined)[][][],
  previewBlocks: (Block | undefined)[][][],
  previewMode: BlockModificationMode,
  atlas: Atlas,
  blocks: ProjectBlocks,
  dimensions: { xDim: number; yDim: number; zDim: number }
): {
  meshFaces: Map<string, VoxelFaces>;
  previewFaces: Map<string, VoxelFaces>;
} => {
  const exteriorFaces: Map<string, VoxelFaces> = new Map();
  const previewFaces: Map<string, VoxelFaces> = new Map();

  const { xDim, yDim, zDim } = dimensions;
  const expandedXDim = xDim + 2;
  const expandedYDim = yDim + 2;
  const expandedZDim = zDim + 2;
  const visitedSize = expandedXDim * expandedYDim * expandedZDim;

  const visited = new Uint8Array(visitedSize);
  const queued = new Uint8Array(visitedSize);

  const queueCapacity = Math.min(visitedSize, 1000000);
  const queueX = new Int16Array(queueCapacity);
  const queueY = new Int16Array(queueCapacity);
  const queueZ = new Int16Array(queueCapacity);
  let queueStart = 0;
  let queueEnd = 0;

  const minX = -1;
  const maxX = xDim;
  const minY = -1;
  const maxY = yDim;
  const minZ = -1;
  const maxZ = zDim;

  const isInExplorationBounds = (x: number, y: number, z: number): boolean => {
    return (
      x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ
    );
  };

  const isSolid = (x: number, y: number, z: number): boolean => {
    if (x < 0 || x >= xDim || y < 0 || y >= yDim || z < 0 || z >= zDim)
      return false;
    return !!realBlocks[x]?.[y]?.[z];
  };

  const isAir = (x: number, y: number, z: number): boolean => {
    return !isSolid(x, y, z);
  };

  const getBlock = (x: number, y: number, z: number): Block | undefined => {
    if (x < 0 || x >= xDim || y < 0 || y >= yDim || z < 0 || z >= zDim)
      return undefined;
    return realBlocks[x]?.[y]?.[z];
  };

  const getPreviewBlock = (
    x: number,
    y: number,
    z: number
  ): Block | undefined => {
    if (x < 0 || x >= xDim || y < 0 || y >= yDim || z < 0 || z >= zDim)
      return undefined;
    return previewBlocks?.[x]?.[y]?.[z];
  };

  const getVisitedIndex = (x: number, y: number, z: number): number => {
    return (
      (x + 1) * expandedYDim * expandedZDim + (y + 1) * expandedZDim + (z + 1)
    );
  };

  const isVisited = (x: number, y: number, z: number): boolean => {
    return visited[getVisitedIndex(x, y, z)] === 1;
  };

  const isQueued = (x: number, y: number, z: number): boolean => {
    return queued[getVisitedIndex(x, y, z)] === 1;
  };

  const enqueue = (x: number, y: number, z: number): void => {
    const index = getVisitedIndex(x, y, z);
    if (queued[index] === 1) return;

    if (queueEnd >= queueCapacity) {
      console.warn(
        `[LayerMesh] Flood fill queue capacity exceeded, skipping (${x}, ${y}, ${z})`
      );
      return;
    }

    queueX[queueEnd] = x;
    queueY[queueEnd] = y;
    queueZ[queueEnd] = z;
    queued[index] = 1;
    queueEnd++;
  };

  const dequeue = (): { x: number; y: number; z: number } | null => {
    if (queueStart >= queueEnd) return null;
    const result = {
      x: queueX[queueStart],
      y: queueY[queueStart],
      z: queueZ[queueStart],
    };
    queueStart++;
    return result;
  };

  const queueSize = (): number => queueEnd - queueStart;

  const directions = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  const isEraseMode = previewMode.tag === BlockModificationMode.Erase.tag;
  const isBuildMode = previewMode.tag === BlockModificationMode.Build.tag;

  const borderSpacing = 4;
  for (let x = minX; x <= maxX; x += borderSpacing) {
    for (let y = minY; y <= maxY; y += borderSpacing) {
      for (let z = minZ; z <= maxZ; z += borderSpacing) {
        if (
          x === minX ||
          x === maxX ||
          y === minY ||
          y === maxY ||
          z === minZ ||
          z === maxZ
        ) {
          if (isInExplorationBounds(x, y, z) && isAir(x, y, z)) {
            enqueue(x, y, z);
          }
        }
      }
    }
  }

  while (queueSize() > 0) {
    const current = dequeue();
    if (!current) break;

    const { x, y, z } = current;
    const visitedIndex = getVisitedIndex(x, y, z);
    if (visited[visitedIndex] === 1) continue;
    visited[visitedIndex] = 1;

    const sourceIsPreview = !!getPreviewBlock(x, y, z);

    for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
      const dir = directions[dirIndex];
      const nx = x + dir[0];
      const ny = y + dir[1];
      const nz = z + dir[2];

      const previewBlock = getPreviewBlock(nx, ny, nz);
      const hasPreview = !!previewBlock;
      const block = getBlock(nx, ny, nz);
      const hasReal = !!block;

      if (
        isInExplorationBounds(nx, ny, nz) &&
        (isAir(nx, ny, nz) || (isEraseMode && hasPreview)) &&
        !isVisited(nx, ny, nz) &&
        !isQueued(nx, ny, nz)
      ) {
        enqueue(nx, ny, nz);
      }

      if (hasReal && (isBuildMode || !hasPreview)) {
        // blocks are 1 indexed because 0 is reserved for air
        const blockTemplate = blocks.blockFaceAtlasIndexes[block.type - 1];

        const oppositeDirIndex =
          dirIndex % 2 === 0 ? dirIndex + 1 : dirIndex - 1;
        const index = blockTemplate[oppositeDirIndex];
        const key = `${nx},${ny},${nz},${index}`;

        if (!exteriorFaces.has(key)) {
          exteriorFaces.set(key, {
            textureIndex: index,
            faceIndexes: [],
            gridPos: new THREE.Vector3(nx, ny, nz),
          });
        }

        exteriorFaces.get(key)!.faceIndexes.push(oppositeDirIndex);
      }

      if (hasPreview && !sourceIsPreview) {
        // blocks are 1 indexed because 0 is reserved for air
        const blueprint = blocks.blockFaceAtlasIndexes[previewBlock.type - 1];

        const oppositeDirIndex =
          dirIndex % 2 === 0 ? dirIndex + 1 : dirIndex - 1;
        const index = blueprint[oppositeDirIndex];
        const key = `${nx},${ny},${nz},${index}`;

        if (!previewFaces.has(key)) {
          previewFaces.set(key, {
            textureIndex: index,
            faceIndexes: [],
            gridPos: new THREE.Vector3(nx, ny, nz),
          });
        }

        previewFaces.get(key)!.faceIndexes.push(oppositeDirIndex);
      }
    }
  }

  return { meshFaces: exteriorFaces, previewFaces };
};
