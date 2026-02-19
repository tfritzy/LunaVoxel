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
    case "Cross": {
      const dx = Math.abs(x + 0.5 - p.centerX) * p.invRadiusX;
      const dz = Math.abs(z + 0.5 - p.centerZ) * p.invRadiusZ;
      return dx <= 1 / 3 || dz <= 1 / 3;
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
  switch (shape) {
    case "Rect":
      return true;
    case "Sphere":
      return isInsideSphere(x, y, z, minX, maxX, minY, maxY, minZ, maxZ);
    case "Cylinder":
      return isInsideCylinder(x, z, minX, maxX, minZ, maxZ);
    case "Triangle":
      return isInsideTriangle(x, y, minX, maxX, minY, maxY);
    case "Diamond":
      return isInsideDiamond(x, y, z, minX, maxX, minY, maxY, minZ, maxZ);
    case "Cone":
      return isInsideCone(x, y, z, minX, maxX, minY, maxY, minZ, maxZ);
    case "Pyramid":
      return isInsidePyramid(x, y, z, minX, maxX, minY, maxY, minZ, maxZ);
    case "Hexagon":
      return isInsideHexagon(x, z, minX, maxX, minZ, maxZ);
    case "Cross":
      return isInsideCross(x, z, minX, maxX, minZ, maxZ);
  }
}

function isInsideSphere(
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
  const radiusX = (maxX - minX + 1) / 2;
  const radiusY = (maxY - minY + 1) / 2;
  const radiusZ = (maxZ - minZ + 1) / 2;
  const centerX = (minX + maxX + 1) / 2;
  const centerY = (minY + maxY + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const dx = (x + 0.5 - centerX) / radiusX;
  const dy = (y + 0.5 - centerY) / radiusY;
  const dz = (z + 0.5 - centerZ) / radiusZ;

  return dx * dx + dy * dy + dz * dz <= 1;
}

function isInsideCylinder(
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): boolean {
  const radiusX = (maxX - minX + 1) / 2;
  const radiusZ = (maxZ - minZ + 1) / 2;
  const centerX = (minX + maxX + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const dx = (x + 0.5 - centerX) / radiusX;
  const dz = (z + 0.5 - centerZ) / radiusZ;

  return dx * dx + dz * dz <= 1;
}

function isInsideTriangle(
  x: number,
  y: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): boolean {
  const height = maxY - minY + 1;
  const width = maxX - minX + 1;
  const row = maxY - y;
  const fraction = (row + 0.5) / height;
  const rowWidth = width * fraction;
  const centerX = (minX + maxX + 1) / 2;
  const dx = Math.abs(x + 0.5 - centerX);

  return dx <= rowWidth / 2;
}

function isInsideDiamond(
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
  const centerX = (minX + maxX + 1) / 2;
  const centerY = (minY + maxY + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const radiusX = (maxX - minX + 1) / 2;
  const radiusY = (maxY - minY + 1) / 2;
  const radiusZ = (maxZ - minZ + 1) / 2;
  const dx = Math.abs(x + 0.5 - centerX) / radiusX;
  const dy = Math.abs(y + 0.5 - centerY) / radiusY;
  const dz = Math.abs(z + 0.5 - centerZ) / radiusZ;

  return dx + dy + dz <= 1;
}

function isInsideCone(
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
  const height = maxY - minY + 1;
  const row = maxY - y;
  const fraction = (row + 0.5) / height;

  const radiusX = (maxX - minX + 1) / 2;
  const radiusZ = (maxZ - minZ + 1) / 2;
  const centerX = (minX + maxX + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const dx = (x + 0.5 - centerX) / (radiusX * fraction);
  const dz = (z + 0.5 - centerZ) / (radiusZ * fraction);

  return fraction > 0 && dx * dx + dz * dz <= 1;
}

function isInsidePyramid(
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
  const height = maxY - minY + 1;
  const row = maxY - y;
  const topFraction = height <= 1 ? 1 : 1 - row / (height - 1);
  const minDiameter = Math.min(maxX - minX + 1, maxZ - minZ + 1);
  const maxInset = Math.floor((minDiameter - 1) / 2);
  const inset = maxInset > 0 ? Math.floor(topFraction * maxInset) : 0;

  const centerX = (minX + maxX + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const halfWidthX = Math.max(0, (maxX - minX + 1) / 2 - inset);
  const halfWidthZ = Math.max(0, (maxZ - minZ + 1) / 2 - inset);
  const dx = Math.abs(x + 0.5 - centerX);
  const dz = Math.abs(z + 0.5 - centerZ);

  return dx <= halfWidthX && dz <= halfWidthZ;
}

function isInsideHexagon(
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): boolean {
  const radiusX = (maxX - minX + 1) / 2;
  const radiusZ = (maxZ - minZ + 1) / 2;
  const centerX = (minX + maxX + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const dx = Math.abs(x + 0.5 - centerX) / radiusX;
  const dz = Math.abs(z + 0.5 - centerZ) / radiusZ;

  return dx <= 1 && dz + dx * 0.5 <= 1;
}

function isInsideCross(
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): boolean {
  const radiusX = (maxX - minX + 1) / 2;
  const radiusZ = (maxZ - minZ + 1) / 2;
  const centerX = (minX + maxX + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const dx = Math.abs(x + 0.5 - centerX) / radiusX;
  const dz = Math.abs(z + 0.5 - centerZ) / radiusZ;

  return dx <= 1 / 3 || dz <= 1 / 3;
}
