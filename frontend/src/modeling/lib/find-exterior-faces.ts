import { BlockModificationMode, BlockRun, MeshType } from "@/module_bindings";
import * as THREE from "three";
import { VoxelFaces } from "./chunk-mesh";

export function findExteriorFaces(
  realBlocks: (BlockRun | undefined)[][][],
  previewBlocks: (MeshType | undefined)[][][],
  previewMode: BlockModificationMode,
  dimensions: { xDim: number; yDim: number; zDim: number }
): Map<string, VoxelFaces> {
  const exteriorFaces: Map<string, VoxelFaces> = new Map();

  // Use typed arrays for better performance
  const visitedSize =
    (dimensions.xDim + 2) * (dimensions.yDim + 2) * (dimensions.zDim + 2);
  const visited = new Uint8Array(visitedSize);

  // Pre-allocate queue with reasonable capacity
  const queueCapacity = Math.min(visitedSize, 100000);
  const queueX = new Int16Array(queueCapacity);
  const queueY = new Int16Array(queueCapacity);
  const queueZ = new Int16Array(queueCapacity);
  let queueStart = 0;
  let queueEnd = 0;

  const minX = -1;
  const maxX = dimensions.xDim;
  const minY = -1;
  const maxY = dimensions.yDim;
  const minZ = -1;
  const maxZ = dimensions.zDim;

  // Optimize bounds checking with inline functions
  const isInVoxelBounds = (x: number, y: number, z: number): boolean => {
    return (
      x >= 0 &&
      x < dimensions.xDim &&
      y >= 0 &&
      y < dimensions.yDim &&
      z >= 0 &&
      z < dimensions.zDim
    );
  };

  const isInExplorationBounds = (x: number, y: number, z: number): boolean => {
    return (
      x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ
    );
  };

  const isAir = (x: number, y: number, z: number): boolean => {
    return (
      !isInVoxelBounds(x, y, z) ||
      !realBlocks[x]?.[y]?.[z] ||
      (!!previewBlocks?.[x]?.[y]?.[z] &&
        previewMode != BlockModificationMode.Paint)
    );
  };

  const getBlock = (x: number, y: number, z: number): BlockRun | undefined => {
    if (!isInVoxelBounds(x, y, z)) return undefined;
    // TODO: Integrate previewBlocks logic here if needed for face culling
    return realBlocks[x]?.[y]?.[z];
  };

  // 3D coordinate to 1D index mapping for visited array
  const getVisitedIndex = (x: number, y: number, z: number): number => {
    const adjustedX = x + 1; // Shift by 1 since minX = -1
    const adjustedY = y + 1;
    const adjustedZ = z + 1;
    return (
      adjustedX * (dimensions.yDim + 2) * (dimensions.zDim + 2) +
      adjustedY * (dimensions.zDim + 2) +
      adjustedZ
    );
  };

  const isVisited = (x: number, y: number, z: number): boolean => {
    return visited[getVisitedIndex(x, y, z)] === 1;
  };

  const setVisited = (x: number, y: number, z: number): void => {
    visited[getVisitedIndex(x, y, z)] = 1;
  };

  // Queue operations
  const enqueue = (x: number, y: number, z: number): void => {
    if (queueEnd >= queueCapacity) {
      console.warn(
        `[ChunkMesh] Flood fill queue capacity exceeded, skipping (${x}, ${y}, ${z})`
      );
      return;
    }
    queueX[queueEnd] = x;
    queueY[queueEnd] = y;
    queueZ[queueEnd] = z;
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

  // Static direction arrays for better performance
  const directions = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  // Initialize flood fill from multiple border points for faster coverage
  const borderSpacing = 4; // Sample every 4th border point

  // Add points along edges instead of just one corner
  for (let x = minX; x <= maxX; x += borderSpacing) {
    for (let y = minY; y <= maxY; y += borderSpacing) {
      for (let z = minZ; z <= maxZ; z += borderSpacing) {
        // Only add if it's actually on the border
        if (
          x === minX ||
          x === maxX ||
          y === minY ||
          y === maxY ||
          z === minZ ||
          z === maxZ
        ) {
          if (
            isInExplorationBounds(x, y, z) &&
            isAir(x, y, z) &&
            !isVisited(x, y, z)
          ) {
            enqueue(x, y, z);
            setVisited(x, y, z);
          }
        }
      }
    }
  }

  while (queueSize() > 0) {
    const current = dequeue();
    if (!current) break;

    const { x, y, z } = current;

    // Check all 6 directions using static array
    for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
      const dir = directions[dirIndex];
      const nx = x + dir[0];
      const ny = y + dir[1];
      const nz = z + dir[2];

      if (
        isInExplorationBounds(nx, ny, nz) &&
        isAir(nx, ny, nz) &&
        !isVisited(nx, ny, nz)
      ) {
        setVisited(nx, ny, nz);
        enqueue(nx, ny, nz);
      }

      // Check for solid blocks to create exterior faces
      if (!isAir(nx, ny, nz)) {
        const key = `${nx},${ny},${nz}`;
        const block = getBlock(nx, ny, nz);
        const blockColor = block?.color ? block.color : "#ffffff";

        if (!exteriorFaces.has(key)) {
          exteriorFaces.set(key, {
            color: blockColor,
            faceIndexes: [],
            gridPos: new THREE.Vector3(nx, ny, nz),
          });
        }

        const oppositeDirIndex =
          dirIndex % 2 === 0 ? dirIndex + 1 : dirIndex - 1;
        exteriorFaces.get(key)!.faceIndexes.push(oppositeDirIndex);
      }
    }
  }

  return exteriorFaces;
}
