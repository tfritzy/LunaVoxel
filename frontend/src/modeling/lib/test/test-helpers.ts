import type { Vector3 } from "@/state/types";
import { SparseVoxelOctree } from "@/state/sparse-voxel-octree";

/**
 * Helper function to create voxel data structure
 */
export function createVoxelData(dimensions: Vector3): SparseVoxelOctree {
  return new SparseVoxelOctree(dimensions);
}

/**
 * Helper function to set a voxel
 */
export function setVoxel(
  voxelData: SparseVoxelOctree,
  x: number,
  y: number,
  z: number,
  blockType: number
): void {
  voxelData.set(x, y, z, blockType);
}
