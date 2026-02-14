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

  let wasInsideBounds = isInsideBounds(x, y, z);

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
    } else if (wasInsideBounds && !currentlyInsideBounds) {
      const normal = new THREE.Vector3(0, 0, 0);
      if (lastStepAxis === 0) normal.x = -stepX;
      else if (lastStepAxis === 1) normal.y = -stepY;
      else if (lastStepAxis === 2) normal.z = -stepZ;

      const boundaryX = x < 0 ? 0 : (x >= dimensions.x ? dimensions.x - 1 : x);
      const boundaryY = y < 0 ? 0 : (y >= dimensions.y ? dimensions.y - 1 : y);
      const boundaryZ = z < 0 ? 0 : (z >= dimensions.z ? dimensions.z - 1 : z);

      return {
        gridPosition: new THREE.Vector3(boundaryX, boundaryY, boundaryZ),
        normal,
        blockValue: RAYCASTABLE_BIT,
      };
    }

    wasInsideBounds = currentlyInsideBounds;

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

  return intersectBoundingPlanes(origin, dir, dimensions, maxDistance);
}

function intersectBoundingPlanes(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  dimensions: Vector3,
  maxDistance: number
): VoxelRaycastResult | null {
  const planes: { pos: number; axis: "x" | "y" | "z"; normal: THREE.Vector3 }[] = [
    { pos: 0, axis: "x", normal: new THREE.Vector3(1, 0, 0) },
    { pos: dimensions.x, axis: "x", normal: new THREE.Vector3(-1, 0, 0) },
    { pos: 0, axis: "y", normal: new THREE.Vector3(0, 1, 0) },
    { pos: dimensions.y, axis: "y", normal: new THREE.Vector3(0, -1, 0) },
    { pos: 0, axis: "z", normal: new THREE.Vector3(0, 0, 1) },
    { pos: dimensions.z, axis: "z", normal: new THREE.Vector3(0, 0, -1) },
  ];

  let closestT = Infinity;
  let closestResult: VoxelRaycastResult | null = null;

  for (const plane of planes) {
    const dirComponent = dir[plane.axis];
    if (dirComponent === 0) continue;

    const t = (plane.pos - origin[plane.axis]) / dirComponent;
    if (t < 0 || t > maxDistance || t >= closestT) continue;

    const hitFromFront = dir.dot(plane.normal) < 0;
    if (!hitFromFront) continue;

    const hit = origin.clone().addScaledVector(dir, t);
    closestT = t;

    const gridX = Math.floor(hit.x);
    const gridY = Math.floor(hit.y);
    const gridZ = Math.floor(hit.z);

    closestResult = {
      gridPosition: new THREE.Vector3(
        plane.axis === "x" ? (plane.pos === 0 ? 0 : dimensions.x - 1) : gridX,
        plane.axis === "y" ? (plane.pos === 0 ? 0 : dimensions.y - 1) : gridY,
        plane.axis === "z" ? (plane.pos === 0 ? 0 : dimensions.z - 1) : gridZ,
      ),
      normal: plane.normal.clone(),
      blockValue: RAYCASTABLE_BIT,
    };
  }

  return closestResult;
}
