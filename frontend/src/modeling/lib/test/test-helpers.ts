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
