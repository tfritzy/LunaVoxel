import type { Vector3 } from "@/state/types";

export interface RectBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export const calculateRectBounds = (
  start: Vector3,
  end: Vector3,
  dimensions: Vector3
): RectBounds => {
  const clamp = (val: number, max: number) =>
    Math.max(0, Math.min(val, max - 1));

  const sx = clamp(start.x, dimensions.x);
  const sy = clamp(start.y, dimensions.y);
  const sz = clamp(start.z, dimensions.z);

  const ex = clamp(end.x, dimensions.x);
  const ey = clamp(end.y, dimensions.y);
  const ez = clamp(end.z, dimensions.z);

  return {
    minX: Math.min(sx, ex),
    maxX: Math.max(sx, ex),
    minY: Math.min(sy, ey),
    maxY: Math.max(sy, ey),
    minZ: Math.min(sz, ez),
    maxZ: Math.max(sz, ez),
  };
};

export const snapBoundsToEqual = (
  bounds: RectBounds,
  start: Vector3
): RectBounds => {
  const sizeX = bounds.maxX - bounds.minX;
  const sizeY = bounds.maxY - bounds.minY;
  const sizeZ = bounds.maxZ - bounds.minZ;
  const maxSize = Math.max(sizeX, sizeY, sizeZ);

  const result = { ...bounds };

  if (start.x <= bounds.minX) {
    result.maxX = bounds.minX + maxSize;
  } else {
    result.minX = bounds.maxX - maxSize;
  }

  if (start.y <= bounds.minY) {
    result.maxY = bounds.minY + maxSize;
  } else {
    result.minY = bounds.maxY - maxSize;
  }

  if (start.z <= bounds.minZ) {
    result.maxZ = bounds.minZ + maxSize;
  } else {
    result.minZ = bounds.maxZ - maxSize;
  }

  return result;
};
