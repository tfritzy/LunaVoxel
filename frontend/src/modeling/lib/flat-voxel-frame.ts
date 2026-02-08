import type { Vector3 } from "@/state/types";
import { SparseVoxelOctree } from "@/state/sparse-voxel-octree";

/**
 * A flat VoxelFrame that uses a 1D Uint8Array for voxel data storage.
 * This avoids the need for 3D index calculations when working with voxel data.
 */
export class FlatVoxelFrame {
  private dimensions: Vector3;
  private minPos: Vector3;
  private data: SparseVoxelOctree;

  constructor(
    dimensions: Vector3,
    minPos?: Vector3,
    data?: SparseVoxelOctree
  ) {
    this.dimensions = { ...dimensions };
    this.minPos = minPos ? { ...minPos } : { x: 0, y: 0, z: 0 };
    this.data = data ?? new SparseVoxelOctree(dimensions);
  }

  /**
   * Check if the frame is empty (no voxels set)
   */
  public isEmpty(): boolean {
    return this.data.isEmpty();
  }

  /**
   * Check if a voxel at the given position is set (non-zero)
   * @param x World X coordinate
   * @param y World Y coordinate
   * @param z World Z coordinate
   */
  public isSet(x: number, y: number, z: number): boolean {
    const localX = x - this.minPos.x;
    const localY = y - this.minPos.y;
    const localZ = z - this.minPos.z;
    if (localX < 0 || localX >= this.dimensions.x ||
        localY < 0 || localY >= this.dimensions.y ||
        localZ < 0 || localZ >= this.dimensions.z) {
      return false;
    }
    return this.data.isSet(localX, localY, localZ);
  }

  /**
   * Get the block value at a given position (0 if not set)
   * @param x World X coordinate
   * @param y World Y coordinate
   * @param z World Z coordinate
   */
  public get(x: number, y: number, z: number): number {
    const localX = x - this.minPos.x;
    const localY = y - this.minPos.y;
    const localZ = z - this.minPos.z;
    if (localX < 0 || localX >= this.dimensions.x ||
        localY < 0 || localY >= this.dimensions.y ||
        localZ < 0 || localZ >= this.dimensions.z) {
      return 0;
    }
    return this.data.get(localX, localY, localZ);
  }

  /**
   * Set a voxel at the given position to a specific block index
   * @param x World X coordinate
   * @param y World Y coordinate
   * @param z World Z coordinate
   * @param blockIndex The block value to set
   */
  public set(x: number, y: number, z: number, blockIndex: number): void {
    const localX = x - this.minPos.x;
    const localY = y - this.minPos.y;
    const localZ = z - this.minPos.z;
    if (localX < 0 || localX >= this.dimensions.x ||
        localY < 0 || localY >= this.dimensions.y ||
        localZ < 0 || localZ >= this.dimensions.z) {
      return;
    }
    this.data.set(localX, localY, localZ, blockIndex);
  }

  /**
   * Get a voxel value by flat array index
   * @param index The flat array index
   */
  public getByIndex(index: number): number {
    return this.data.getByIndex(index);
  }

  /**
   * Set a voxel value by flat array index
   * @param index The flat array index
   * @param blockIndex The block value to set
   */
  public setByIndex(index: number, blockIndex: number): void {
    this.data.setByIndex(index, blockIndex);
  }

  /**
   * Check if a voxel at the given index is set (non-zero)
   * @param index The flat array index
   */
  public isSetByIndex(index: number): boolean {
    return this.data.isSetByIndex(index);
  }

  /**
   * Clear all voxels in the frame
   */
  public clear(): void {
    this.data.clear();
  }

  /**
   * Get the dimensions of this frame
   */
  public getDimensions(): Vector3 {
    return { ...this.dimensions };
  }

  /**
   * Get the minimum position (offset) of this frame in world space
   */
  public getMinPos(): Vector3 {
    return { ...this.minPos };
  }

  /**
   * Get the raw flat data array
   */
  public getData(): SparseVoxelOctree {
    return this.data;
  }
}
