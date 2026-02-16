import type { FillShape } from "./tool-type";

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
    case "Star":
      return isInsideStar(x, z, minX, maxX, minZ, maxZ);
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
  const fraction = (row + 0.5) / height;

  const centerX = (minX + maxX + 1) / 2;
  const centerZ = (minZ + maxZ + 1) / 2;
  const halfWidthX = ((maxX - minX + 1) / 2) * fraction;
  const halfWidthZ = ((maxZ - minZ + 1) / 2) * fraction;
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

function isInsideStar(
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

  return dx + dz <= 1 || dx <= 0.35 || dz <= 0.35;
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
