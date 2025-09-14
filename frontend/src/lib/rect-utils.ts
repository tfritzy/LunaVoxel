import { Vector3 } from "@/module_bindings";

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
  return {
    minX: Math.max(0, Math.min(start.x, end.x)),
    maxX: Math.min(dimensions.x - 1, Math.max(start.x, end.x)),
    minY: Math.max(0, Math.min(start.y, end.y)),
    maxY: Math.min(dimensions.y - 1, Math.max(start.y, end.y)),
    minZ: Math.max(0, Math.min(start.z, end.z)),
    maxZ: Math.min(dimensions.z - 1, Math.max(start.z, end.z)),
  };
};
