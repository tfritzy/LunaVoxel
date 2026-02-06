import type { Vector3 } from "@/state";

export class VoxelFrame {
  private dimensions: Vector3;
  private minPos: Vector3;
  private data: Uint8Array[][]; // 3D array for direct access: data[x][y][z]
  private empty: boolean = true; // Track whether any voxels are set

  constructor(dimensions: Vector3, minPos?: Vector3) {
    this.dimensions = { ...dimensions };
    this.minPos = minPos ? { ...minPos } : { x: 0, y: 0, z: 0 };
    this.data = [];
    
    // Initialize 3D array structure
    for (let x = 0; x < dimensions.x; x++) {
      this.data[x] = [];
      for (let y = 0; y < dimensions.y; y++) {
        this.data[x][y] = new Uint8Array(dimensions.z);
      }
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
    return this.data[localX][localY][localZ] !== 0;
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
    return this.data[localX][localY][localZ];
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
    this.data[localX][localY][localZ] = blockIndex;
    if (blockIndex !== 0) {
      this.empty = false;
    }
  }

  /**
   * Clear all voxels in the frame
   */
  public clear(): void {
    for (let x = 0; x < this.dimensions.x; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        this.data[x][y].fill(0);
      }
    }
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

    const newData: Uint8Array[][] = [];

    // Initialize new 3D array structure
    for (let x = 0; x < newDimensions.x; x++) {
      newData[x] = [];
      for (let y = 0; y < newDimensions.y; y++) {
        newData[x][y] = new Uint8Array(newDimensions.z);
      }
    }

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
          newData[newLocalX][newLocalY][newLocalZ] = this.data[oldLocalX][oldLocalY][oldLocalZ];
        }
      }
    }

    this.dimensions = { ...newDimensions };
    this.minPos = { ...targetMinPos };
    this.data = newData;
  }

  /**
   * Check if any voxel in the frame is set
   */
  public hasAnySet(): boolean {
    for (let x = 0; x < this.dimensions.x; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        for (let z = 0; z < this.dimensions.z; z++) {
          if (this.data[x][y][z] !== 0) return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if this frame equals another frame
   */
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

    for (let x = 0; x < this.dimensions.x; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        for (let z = 0; z < this.dimensions.z; z++) {
          if (this.data[x][y][z] !== other.data[x][y][z]) return false;
        }
      }
    }

    return true;
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
      
      for (let x = 0; x < this.dimensions.x; x++) {
        for (let y = 0; y < this.dimensions.y; y++) {
          cloned.data[x][y].set(this.data[x][y]);
        }
      }
      
      cloned.empty = this.empty;
      return cloned;
    }
  }
}

