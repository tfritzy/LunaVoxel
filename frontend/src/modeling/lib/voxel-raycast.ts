import * as THREE from "three";
import type { Vector3 } from "@/state/types";
import { isBlockRaycastable } from "./voxel-data-utils";
import { RAYCASTABLE_BIT } from "./voxel-constants";

export interface VoxelRaycastResult {
  gridPosition: THREE.Vector3;
  normal: THREE.Vector3;
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

  const isInsideBounds = (px: number, py: number, pz: number): boolean => {
    return px >= 0 && px < dimensions.x &&
           py >= 0 && py < dimensions.y &&
           pz >= 0 && pz < dimensions.z;
  };

  const isInRange = (value: number, dim: number): boolean => {
    return value >= 0 && value < dim;
  };

  let wasInsideX = isInRange(x, dimensions.x);
  let wasInsideY = isInRange(y, dimensions.y);
  let wasInsideZ = isInRange(z, dimensions.z);

  const maxIterations = Math.ceil(maxDistance) * 3 + dimensions.x + dimensions.y + dimensions.z;
  for (let i = 0; i < maxIterations; i++) {
    const minT = Math.min(tMaxX, tMaxY, tMaxZ);
    if (minT > maxDistance) break;

    const currentlyInsideBounds = isInsideBounds(x, y, z);

    if (currentlyInsideBounds) {
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

        return {
          gridPosition: new THREE.Vector3(x, y, z),
          normal,
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

    const nowInsideX = isInRange(x, dimensions.x);
    const nowInsideY = isInRange(y, dimensions.y);
    const nowInsideZ = isInRange(z, dimensions.z);

    if (lastStepAxis === 0 && wasInsideX && !nowInsideX) {
      const boundaryX = x < 0 ? 0 : dimensions.x - 1;
      return {
        gridPosition: new THREE.Vector3(boundaryX, y, z),
        normal: new THREE.Vector3(-stepX, 0, 0),
        blockValue: RAYCASTABLE_BIT,
      };
    }
    if (lastStepAxis === 1 && wasInsideY && !nowInsideY) {
      const boundaryY = y < 0 ? 0 : dimensions.y - 1;
      return {
        gridPosition: new THREE.Vector3(x, boundaryY, z),
        normal: new THREE.Vector3(0, -stepY, 0),
        blockValue: RAYCASTABLE_BIT,
      };
    }
    if (lastStepAxis === 2 && wasInsideZ && !nowInsideZ) {
      const boundaryZ = z < 0 ? 0 : dimensions.z - 1;
      return {
        gridPosition: new THREE.Vector3(x, y, boundaryZ),
        normal: new THREE.Vector3(0, 0, -stepZ),
        blockValue: RAYCASTABLE_BIT,
      };
    }

    wasInsideX = nowInsideX;
    wasInsideY = nowInsideY;
    wasInsideZ = nowInsideZ;

    if (
      (stepX > 0 && x > dimensions.x && !wasInsideY && !wasInsideZ) ||
      (stepX < 0 && x < 0 && !wasInsideY && !wasInsideZ) ||
      (stepY > 0 && y > dimensions.y && !wasInsideX && !wasInsideZ) ||
      (stepY < 0 && y < 0 && !wasInsideX && !wasInsideZ) ||
      (stepZ > 0 && z > dimensions.z && !wasInsideX && !wasInsideY) ||
      (stepZ < 0 && z < 0 && !wasInsideX && !wasInsideY)
    ) {
      break;
    }
  }

  return null;
}
