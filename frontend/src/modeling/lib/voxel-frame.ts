import type { Vector3 } from "@/state/types";
import { SparseVoxelOctree } from "@/state/sparse-voxel-octree";

export class VoxelFrame {
  private dimensions: Vector3;
  private minPos: Vector3;
  private data: SparseVoxelOctree;

  constructor(dimensions: Vector3, minPos?: Vector3) {
    this.dimensions = { ...dimensions };
    this.minPos = minPos ? { ...minPos } : { x: 0, y: 0, z: 0 };
    this.data = new SparseVoxelOctree(dimensions);
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
   * Get the maximum position of this frame in world space
   */
  public getMaxPos(): Vector3 {
    return {
      x: this.minPos.x + this.dimensions.x,
      y: this.minPos.y + this.dimensions.y,
      z: this.minPos.z + this.dimensions.z,
    };
  }

  /**
   * Resize the frame to new dimensions and/or position
   */
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

    const newData = new SparseVoxelOctree(newDimensions);
    this.data.forEach((entry) => {
      const worldX = entry.x + this.minPos.x;
      const worldY = entry.y + this.minPos.y;
      const worldZ = entry.z + this.minPos.z;

      if (
        worldX < targetMinPos.x ||
        worldY < targetMinPos.y ||
        worldZ < targetMinPos.z ||
        worldX >= targetMinPos.x + newDimensions.x ||
        worldY >= targetMinPos.y + newDimensions.y ||
        worldZ >= targetMinPos.z + newDimensions.z
      ) {
        return;
      }

      const newLocalX = worldX - targetMinPos.x;
      const newLocalY = worldY - targetMinPos.y;
      const newLocalZ = worldZ - targetMinPos.z;
      newData.set(newLocalX, newLocalY, newLocalZ, entry.value);
    });

    this.dimensions = { ...newDimensions };
    this.minPos = { ...targetMinPos };
    this.data = newData;
  }

  /**
   * Check if any voxel in the frame is set
   */
  public hasAnySet(): boolean {
    return !this.data.isEmpty();
  }

  /**
   * Check if this frame equals another frame
   */
  public equals(other: VoxelFrame): boolean {
    if (this.isEmpty() && other.isEmpty()) return true;
    if (this.isEmpty() !== other.isEmpty()) return false;
    
    if (
      this.dimensions.x !== other.dimensions.x ||
      this.dimensions.y !== other.dimensions.y ||
      this.dimensions.z !== other.dimensions.z
    ) {
      return false;
    }
    if (
      !this.data.every(
        (entry) => other.data.get(entry.x, entry.y, entry.z) === entry.value
      )
    ) {
      return false;
    }

    return other.data.every(
      (entry) => this.data.get(entry.x, entry.y, entry.z) === entry.value
    );
  }

  /**
   * Clone this frame with an optional new bounds
   * @param newMinPos Optional new minimum position
   * @param newMaxPos Optional new maximum position
   */
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
      const cloned = new VoxelFrame(this.dimensions, this.minPos);
      this.data.forEach((entry) => {
        const worldX = entry.x + this.minPos.x;
        const worldY = entry.y + this.minPos.y;
        const worldZ = entry.z + this.minPos.z;
        cloned.set(worldX, worldY, worldZ, entry.value);
      });
      return cloned;
    }
  }
}
