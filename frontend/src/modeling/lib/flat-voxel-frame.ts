import { Vector3 } from "@/module_bindings";

/**
 * A flat VoxelFrame that uses a 1D Uint8Array for voxel data storage.
 * This avoids the need for 3D index calculations when working with voxel data.
 */
export class FlatVoxelFrame {
  private dimensions: Vector3;
  private minPos: Vector3;
  private data: Uint8Array; // Flat 1D array: index = x * sizeY * sizeZ + y * sizeZ + z
  private empty: boolean = true;

  constructor(dimensions: Vector3, minPos?: Vector3) {
    this.dimensions = { ...dimensions };
    this.minPos = minPos ? { ...minPos } : { x: 0, y: 0, z: 0 };
    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    this.data = new Uint8Array(totalVoxels);
  }

  /**
   * Check if the frame is empty (no voxels set)
   */
  public isEmpty(): boolean {
    return this.empty;
  }

  /**
   * Check if a voxel at the given position is set (non-zero)
   * @param x World X coordinate
   * @param y World Y coordinate
   * @param z World Z coordinate
   */
  public isSet(x: number, y: number, z: number): boolean {
    if (this.empty) return false;
    const localX = x - this.minPos.x;
    const localY = y - this.minPos.y;
    const localZ = z - this.minPos.z;
    if (localX < 0 || localX >= this.dimensions.x ||
        localY < 0 || localY >= this.dimensions.y ||
        localZ < 0 || localZ >= this.dimensions.z) {
      return false;
    }
    const index = localX * this.dimensions.y * this.dimensions.z + localY * this.dimensions.z + localZ;
    return this.data[index] !== 0;
  }

  /**
   * Get the block value at a given position (0 if not set)
   * @param x World X coordinate
   * @param y World Y coordinate
   * @param z World Z coordinate
   */
  public get(x: number, y: number, z: number): number {
    if (this.empty) return 0;
    const localX = x - this.minPos.x;
    const localY = y - this.minPos.y;
    const localZ = z - this.minPos.z;
    if (localX < 0 || localX >= this.dimensions.x ||
        localY < 0 || localY >= this.dimensions.y ||
        localZ < 0 || localZ >= this.dimensions.z) {
      return 0;
    }
    const index = localX * this.dimensions.y * this.dimensions.z + localY * this.dimensions.z + localZ;
    return this.data[index];
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
    const index = localX * this.dimensions.y * this.dimensions.z + localY * this.dimensions.z + localZ;
    this.data[index] = blockIndex;
    if (blockIndex !== 0) {
      this.empty = false;
    }
  }

  /**
   * Clear all voxels in the frame
   */
  public clear(): void {
    this.data.fill(0);
    this.empty = true;
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
  public getData(): Uint8Array {
    return this.data;
  }
}
