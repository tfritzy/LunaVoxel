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
  const row = y - minY;
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
