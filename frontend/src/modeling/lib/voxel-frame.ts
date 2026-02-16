import type { Vector3 } from "@/state/types";

/**
 * Uses a 1D Uint8Array for voxel data storage.
 */
export class VoxelFrame {
  private dimensions: Vector3;
  private minPos: Vector3;
  private data: Uint8Array; // Flat 1D array: index = x * sizeY * sizeZ + y * sizeZ + z
  private empty: boolean = true;

  constructor(dimensions: Vector3, minPos?: Vector3, data?: Uint8Array) {
    this.dimensions = { ...dimensions };
    this.minPos = minPos ? { ...minPos } : { x: 0, y: 0, z: 0 };
    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    
    if (data) {
      this.data = data;
      // Check if data is non-empty
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== 0) {
          this.empty = false;
          break;
        }
      }
    } else {
      this.data = new Uint8Array(totalVoxels);
    }
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
   * Get a voxel value by flat array index
   * @param index The flat array index
   */
  public getByIndex(index: number): number {
    if (this.empty || index < 0 || index >= this.data.length) return 0;
    return this.data[index];
  }

  /**
   * Set a voxel value by flat array index
   * @param index The flat array index
   * @param blockIndex The block value to set
   */
  public setByIndex(index: number, blockIndex: number): void {
    if (index < 0 || index >= this.data.length) return;
    this.data[index] = blockIndex;
    if (blockIndex !== 0) {
      this.empty = false;
    }
  }

  /**
   * Check if a voxel at the given index is set (non-zero)
   * @param index The flat array index
   */
  public isSetByIndex(index: number): boolean {
    if (this.empty || index < 0 || index >= this.data.length) return false;
    return this.data[index] !== 0;
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

  public getMaxPos(): Vector3 {
    return {
      x: this.minPos.x + this.dimensions.x,
      y: this.minPos.y + this.dimensions.y,
      z: this.minPos.z + this.dimensions.z,
    };
  }

  public resize(newDimensions: Vector3, newMinPos?: Vector3): void {
    const targetMinPos = newMinPos || this.minPos;

    if (
      newDimensions.x === this.dimensions.x &&
      newDimensions.y === this.dimensions.y &&
      newDimensions.z === this.dimensions.z &&
      targetMinPos.x === this.minPos.x &&
      targetMinPos.y === this.minPos.y &&
      targetMinPos.z === this.minPos.z
    ) {
      return;
    }

    const newTotal = newDimensions.x * newDimensions.y * newDimensions.z;
    const newData = new Uint8Array(newTotal);

    const overlapMinX = Math.max(this.minPos.x, targetMinPos.x);
    const overlapMinY = Math.max(this.minPos.y, targetMinPos.y);
    const overlapMinZ = Math.max(this.minPos.z, targetMinPos.z);
    const overlapMaxX = Math.min(this.minPos.x + this.dimensions.x, targetMinPos.x + newDimensions.x);
    const overlapMaxY = Math.min(this.minPos.y + this.dimensions.y, targetMinPos.y + newDimensions.y);
    const overlapMaxZ = Math.min(this.minPos.z + this.dimensions.z, targetMinPos.z + newDimensions.z);

    for (let worldX = overlapMinX; worldX < overlapMaxX; worldX++) {
      for (let worldY = overlapMinY; worldY < overlapMaxY; worldY++) {
        for (let worldZ = overlapMinZ; worldZ < overlapMaxZ; worldZ++) {
          const oldLocalX = worldX - this.minPos.x;
          const oldLocalY = worldY - this.minPos.y;
          const oldLocalZ = worldZ - this.minPos.z;
          const newLocalX = worldX - targetMinPos.x;
          const newLocalY = worldY - targetMinPos.y;
          const newLocalZ = worldZ - targetMinPos.z;
          const oldIndex = oldLocalX * this.dimensions.y * this.dimensions.z + oldLocalY * this.dimensions.z + oldLocalZ;
          const newIndex = newLocalX * newDimensions.y * newDimensions.z + newLocalY * newDimensions.z + newLocalZ;
          newData[newIndex] = this.data[oldIndex];
        }
      }
    }

    this.dimensions = { ...newDimensions };
    this.minPos = { ...targetMinPos };
    this.data = newData;
  }

  public hasAnySet(): boolean {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== 0) return true;
    }
    return false;
  }

  public equals(other: VoxelFrame): boolean {
    if (this.empty && other.empty) return true;
    if (this.empty !== other.empty) return false;

    if (
      this.dimensions.x !== other.dimensions.x ||
      this.dimensions.y !== other.dimensions.y ||
      this.dimensions.z !== other.dimensions.z
    ) {
      return false;
    }

    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }

    return true;
  }

  public clone(newMinPos?: Vector3, newMaxPos?: Vector3): VoxelFrame {
    if (newMinPos && newMaxPos) {
      const newDimensions = {
        x: newMaxPos.x - newMinPos.x,
        y: newMaxPos.y - newMinPos.y,
        z: newMaxPos.z - newMinPos.z,
      };
      const cloned = new VoxelFrame(newDimensions, newMinPos);

      for (let worldX = newMinPos.x; worldX < newMaxPos.x; worldX++) {
        for (let worldY = newMinPos.y; worldY < newMaxPos.y; worldY++) {
          for (let worldZ = newMinPos.z; worldZ < newMaxPos.z; worldZ++) {
            const value = this.get(worldX, worldY, worldZ);
            if (value !== 0) {
              cloned.set(worldX, worldY, worldZ, value);
            }
          }
        }
      }

      return cloned;
    } else {
      const cloned = new VoxelFrame(this.dimensions, this.minPos, new Uint8Array(this.data));
      return cloned;
    }
  }
}
