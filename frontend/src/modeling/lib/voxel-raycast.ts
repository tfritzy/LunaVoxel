import * as THREE from "three";
import type { Vector3 } from "@/state/types";
import { isBlockRaycastable } from "./voxel-data-utils";

export interface VoxelRaycastResult {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  gridPosition: THREE.Vector3;
  blockValue: number;
}

export type GetVoxelFn = (x: number, y: number, z: number) => number;

export function raycastVoxels(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  dimensions: Vector3,
  getVoxel: GetVoxelFn,
  maxDistance: number = 1000
): VoxelRaycastResult | null {
  return performRaycast(origin, direction, dimensions, getVoxel, maxDistance);
}

export function performRaycast(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  dimensions: Vector3,
  getVoxel: GetVoxelFn,
  maxDistance: number = 1000
): VoxelRaycastResult | null {
  const dir = direction.clone().normalize();

  const startX = origin.x;
  const startY = origin.y;
  const startZ = origin.z;

  let x = Math.floor(startX);
  let y = Math.floor(startY);
  let z = Math.floor(startZ);

  const stepX = dir.x >= 0 ? 1 : -1;
  const stepY = dir.y >= 0 ? 1 : -1;
  const stepZ = dir.z >= 0 ? 1 : -1;

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  const calculateTMax = (start: number, dir: number, step: number): number => {
    if (dir === 0) return Infinity;
    const floor = Math.floor(start);
    const boundary = step > 0 ? floor + 1 : floor;
    return (boundary - start) / dir;
  };

  let tMaxX = calculateTMax(startX, dir.x, stepX);
  let tMaxY = calculateTMax(startY, dir.y, stepY);
  let tMaxZ = calculateTMax(startZ, dir.z, stepZ);

  let lastStepAxis = -1;

  const maxIterations = Math.ceil(maxDistance) * 3 + dimensions.x + dimensions.y + dimensions.z;
  for (let i = 0; i < maxIterations; i++) {
    const minT = Math.min(tMaxX, tMaxY, tMaxZ);
    if (minT > maxDistance) break;

    if (
      x >= 0 &&
      x < dimensions.x &&
      y >= 0 &&
      y < dimensions.y &&
      z >= 0 &&
      z < dimensions.z
    ) {
      const blockValue = getVoxel(x, y, z);
      if (isBlockRaycastable(blockValue)) {
        const normal = new THREE.Vector3(0, 0, 0);
        if (lastStepAxis === 0) normal.x = -stepX;
        else if (lastStepAxis === 1) normal.y = -stepY;
        else if (lastStepAxis === 2) normal.z = -stepZ;
        else {
          const entryX = dir.x !== 0 ? ((stepX > 0 ? x : x + 1) - startX) / dir.x : Infinity;
          const entryY = dir.y !== 0 ? ((stepY > 0 ? y : y + 1) - startY) / dir.y : Infinity;
          const entryZ = dir.z !== 0 ? ((stepZ > 0 ? z : z + 1) - startZ) / dir.z : Infinity;

          const maxEntry = Math.max(
            entryX > 0 ? entryX : -Infinity,
            entryY > 0 ? entryY : -Infinity,
            entryZ > 0 ? entryZ : -Infinity
          );

          if (maxEntry === entryX) normal.x = -stepX;
          else if (maxEntry === entryY) normal.y = -stepY;
          else normal.z = -stepZ;
        }

        const position = computeEntryPoint(
          origin,
          dir,
          x,
          y,
          z,
          normal
        );

        return {
          position,
          normal,
          gridPosition: new THREE.Vector3(x, y, z),
          blockValue,
        };
      }
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        tMaxX += tDeltaX;
        lastStepAxis = 0;
      } else {
        z += stepZ;
        tMaxZ += tDeltaZ;
        lastStepAxis = 2;
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY;
        tMaxY += tDeltaY;
        lastStepAxis = 1;
      } else {
        z += stepZ;
        tMaxZ += tDeltaZ;
        lastStepAxis = 2;
      }
    }

    const padding = 10;
    if (
      (stepX > 0 && x > dimensions.x + padding) ||
      (stepX < 0 && x < -padding) ||
      (stepY > 0 && y > dimensions.y + padding) ||
      (stepY < 0 && y < -padding) ||
      (stepZ > 0 && z > dimensions.z + padding) ||
      (stepZ < 0 && z < -padding)
    ) {
      break;
    }
  }

  return null;
}

function computeEntryPoint(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  voxelX: number,
  voxelY: number,
  voxelZ: number,
  normal: THREE.Vector3
): THREE.Vector3 {
  let t = 0;

  if (normal.x !== 0) {
    const planeX = normal.x < 0 ? voxelX : voxelX + 1;
    if (dir.x !== 0) {
      t = (planeX - origin.x) / dir.x;
    }
  } else if (normal.y !== 0) {
    const planeY = normal.y < 0 ? voxelY : voxelY + 1;
    if (dir.y !== 0) {
      t = (planeY - origin.y) / dir.y;
    }
  } else if (normal.z !== 0) {
    const planeZ = normal.z < 0 ? voxelZ : voxelZ + 1;
    if (dir.z !== 0) {
      t = (planeZ - origin.z) / dir.z;
    }
  }

  return new THREE.Vector3(
    origin.x + dir.x * t,
    origin.y + dir.y * t,
    origin.z + dir.z * t
  );
}
