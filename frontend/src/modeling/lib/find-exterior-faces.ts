import { BlockModificationMode, BlockRun, MeshType } from "@/module_bindings";
import * as THREE from "three";
import { VoxelFaces } from "./chunk-mesh";

export function findExteriorFaces(
  realBlocks: (BlockRun | undefined)[][][],
  previewBlocks: (MeshType | undefined)[][][],
  previewMode: BlockModificationMode,
  dimensions: { xDim: number; yDim: number; zDim: number }
): {
  meshFaces: Map<string, VoxelFaces>;
  previewFaces: Map<string, VoxelFaces>;
} {
  const exteriorFaces: Map<string, VoxelFaces> = new Map();
  const previewFaces: Map<string, VoxelFaces> = new Map();

  const visitedSize =
    (dimensions.xDim + 2) * (dimensions.yDim + 2) * (dimensions.zDim + 2);
  const visited = new Uint8Array(visitedSize);

  // Add a "queued" bit array to prevent duplicate enqueuing
  const queued = new Uint8Array(visitedSize);

  const expandedVolume = visitedSize;
  const queueCapacity = Math.min(expandedVolume, 1000000); // Reasonable upper limit
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

  const isSolid = (x: number, y: number, z: number): boolean => {
    if (!isInVoxelBounds(x, y, z)) return false;
    return !!realBlocks[x]?.[y]?.[z];
  };

  const isAir = (x: number, y: number, z: number): boolean => {
    return !isSolid(x, y, z);
  };

  const getBlock = (x: number, y: number, z: number): BlockRun | undefined => {
    if (!isInVoxelBounds(x, y, z)) return undefined;
    return realBlocks[x]?.[y]?.[z];
  };

  const getPreviewBlock = (
    x: number,
    y: number,
    z: number
  ): MeshType | undefined => {
    if (!isInVoxelBounds(x, y, z)) return undefined;
    return previewBlocks?.[x]?.[y]?.[z];
  };

  const getVisitedIndex = (x: number, y: number, z: number): number => {
    const adjustedX = x + 1;
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

  const isQueued = (x: number, y: number, z: number): boolean => {
    return queued[getVisitedIndex(x, y, z)] === 1;
  };

  const setQueued = (x: number, y: number, z: number): void => {
    queued[getVisitedIndex(x, y, z)] = 1;
  };

  const enqueue = (x: number, y: number, z: number): void => {
    if (isQueued(x, y, z)) return;

    if (queueEnd >= queueCapacity) {
      console.warn(
        `[ChunkMesh] Flood fill queue capacity exceeded, skipping (${x}, ${y}, ${z})`
      );
      return;
    }

    queueX[queueEnd] = x;
    queueY[queueEnd] = y;
    queueZ[queueEnd] = z;
    setQueued(x, y, z);
    queueEnd++;
  };

  const dequeue = (): {
    x: number;
    y: number;
    z: number;
  } | null => {
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
    if (isVisited(x, y, z)) continue;
    setVisited(x, y, z);

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
        (isAir(nx, ny, nz) ||
          (previewMode.tag === BlockModificationMode.Erase.tag &&
            hasPreview)) &&
        !isVisited(nx, ny, nz) &&
        !isQueued(nx, ny, nz)
      ) {
        enqueue(nx, ny, nz);
      }

      const key = `${nx},${ny},${nz}`;
      if (
        hasReal &&
        (previewMode.tag === BlockModificationMode.Build.tag || !hasPreview)
      ) {
        const blockColor = block?.color ? block.color : 0xffffff;

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

      if (hasPreview && !sourceIsPreview) {
        if (!previewFaces.has(key)) {
          previewFaces.set(key, {
            color: 0xffffff,
            faceIndexes: [],
            gridPos: new THREE.Vector3(nx, ny, nz),
          });
        }

        const oppositeDirIndex =
          dirIndex % 2 === 0 ? dirIndex + 1 : dirIndex - 1;
        previewFaces.get(key)!.faceIndexes.push(oppositeDirIndex);
      }
    }
  }

  return { meshFaces: exteriorFaces, previewFaces };
}
