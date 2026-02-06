import type { Vector3 } from "@/state";

/**
 * Helper function to create voxel data structure
 */
export function createVoxelData(dimensions: Vector3): Uint8Array[][] {
  const voxelData: Uint8Array[][] = [];
  for (let x = 0; x < dimensions.x; x++) {
    voxelData[x] = [];
    for (let y = 0; y < dimensions.y; y++) {
      voxelData[x][y] = new Uint8Array(dimensions.z);
    }
  }
  return voxelData;
}

/**
 * Helper function to set a voxel
 */
export function setVoxel(
  voxelData: Uint8Array[][],
  x: number,
  y: number,
  z: number,
  blockType: number
): void {
  voxelData[x][y][z] = blockType;
}
