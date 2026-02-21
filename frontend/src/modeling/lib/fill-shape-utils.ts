import type { FillShape } from "./tool-type";

export interface ShapeParams {
  centerX: number;
  centerY: number;
  centerZ: number;
  radiusX: number;
  radiusY: number;
  radiusZ: number;
  invRadiusX: number;
  invRadiusY: number;
  invRadiusZ: number;
  height: number;
  invHeight: number;
  maxY: number;
}

export function precomputeShapeParams(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number
): ShapeParams {
  const radiusX = (maxX - minX + 1) / 2;
  const radiusY = (maxY - minY + 1) / 2;
  const radiusZ = (maxZ - minZ + 1) / 2;
  return {
    centerX: (minX + maxX + 1) / 2,
    centerY: (minY + maxY + 1) / 2,
    centerZ: (minZ + maxZ + 1) / 2,
    radiusX,
    radiusY,
    radiusZ,
    invRadiusX: radiusX !== 0 ? 1 / radiusX : 0,
    invRadiusY: radiusY !== 0 ? 1 / radiusY : 0,
    invRadiusZ: radiusZ !== 0 ? 1 / radiusZ : 0,
    height: maxY - minY + 1,
    invHeight: maxY - minY + 1 !== 0 ? 1 / (maxY - minY + 1) : 0,
    maxY,
  };
}

export function isInsideFillShapePrecomputed(
  shape: FillShape,
  x: number,
  y: number,
  z: number,
  p: ShapeParams
): boolean {
  switch (shape) {
    case "Rect":
      return true;
    case "Sphere": {
      const dx = (x + 0.5 - p.centerX) * p.invRadiusX;
      const dy = (y + 0.5 - p.centerY) * p.invRadiusY;
      const dz = (z + 0.5 - p.centerZ) * p.invRadiusZ;
      return dx * dx + dy * dy + dz * dz <= 1;
    }
    case "Cylinder": {
      const dx = (x + 0.5 - p.centerX) * p.invRadiusX;
      const dz = (z + 0.5 - p.centerZ) * p.invRadiusZ;
      return dx * dx + dz * dz <= 1;
    }
    case "Triangle": {
      const row = p.maxY - y;
      const fraction = (row + 0.5) * p.invHeight;
      const rowWidth = (p.radiusX * 2) * fraction;
      const dx = Math.abs(x + 0.5 - p.centerX);
      return dx <= rowWidth / 2;
    }
    case "Diamond": {
      const dx = Math.abs(x + 0.5 - p.centerX) * p.invRadiusX;
      const dy = Math.abs(y + 0.5 - p.centerY) * p.invRadiusY;
      const dz = Math.abs(z + 0.5 - p.centerZ) * p.invRadiusZ;
      return dx + dy + dz <= 1;
    }
    case "Cone": {
      const row = p.maxY - y;
      const fraction = (row + 0.5) * p.invHeight;
      if (fraction <= 0) return false;
      const invFraction = 1 / fraction;
      const dx = (x + 0.5 - p.centerX) * p.invRadiusX * invFraction;
      const dz = (z + 0.5 - p.centerZ) * p.invRadiusZ * invFraction;
      return dx * dx + dz * dz <= 1;
    }
    case "Pyramid": {
      const row = p.maxY - y;
      const topFraction = p.height <= 1 ? 1 : 1 - row / (p.height - 1);
      const minDiameter = Math.min(p.radiusX * 2, p.radiusZ * 2);
      const maxInset = Math.floor((minDiameter - 1) / 2);
      const inset = maxInset > 0 ? Math.floor(topFraction * maxInset) : 0;
      const halfWidthX = Math.max(0, p.radiusX - inset);
      const halfWidthZ = Math.max(0, p.radiusZ - inset);
      const dx = Math.abs(x + 0.5 - p.centerX);
      const dz = Math.abs(z + 0.5 - p.centerZ);
      return dx <= halfWidthX && dz <= halfWidthZ;
    }
    case "Hexagon": {
      const dx = Math.abs(x + 0.5 - p.centerX) * p.invRadiusX;
      const dz = Math.abs(z + 0.5 - p.centerZ) * p.invRadiusZ;
      return dx <= 1 && dz + dx * 0.5 <= 1;
    }
  }
}

export function isInsideFillShape(
  shape: FillShape,
  x: number,
  y: number,
  z: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number
): boolean {
  return isInsideFillShapePrecomputed(
    shape,
    x,
    y,
    z,
    precomputeShapeParams(minX, maxX, minY, maxY, minZ, maxZ)
  );
}
