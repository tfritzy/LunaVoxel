import type { Vector3 } from "@/state/types";

export function createVoxelData(dimensions: Vector3): Uint8Array {
  return new Uint8Array(dimensions.x * dimensions.y * dimensions.z);
}

export function setVoxel(
  voxelData: Uint8Array,
  x: number,
  y: number,
  z: number,
  blockType: number,
  dimensions: Vector3
): void {
  voxelData[x * dimensions.y * dimensions.z + y * dimensions.z + z] = blockType;
}

export function createPaddedVoxelData(dimensions: Vector3): Uint8Array {
  const paddedDimensions = { x: dimensions.x + 2, y: dimensions.y + 2, z: dimensions.z + 2 };
  return new Uint8Array(paddedDimensions.x * paddedDimensions.y * paddedDimensions.z);
}

export function setPaddedVoxel(
  paddedVoxelData: Uint8Array,
  x: number,
  y: number,
  z: number,
  blockType: number,
  dimensions: Vector3
): void {
  const paddedDimensions = { x: dimensions.x + 2, y: dimensions.y + 2, z: dimensions.z + 2 };
  const px = x + 1;
  const py = y + 1;
  const pz = z + 1;
  paddedVoxelData[px * paddedDimensions.y * paddedDimensions.z + py * paddedDimensions.z + pz] = blockType;
}

export function getPaddedDimensions(dimensions: Vector3): Vector3 {
  return { x: dimensions.x + 2, y: dimensions.y + 2, z: dimensions.z + 2 };
}
