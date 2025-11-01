import { Vector3 } from "@/module_bindings";

/**
 * VoxelFrame represents a sparse 8-bit array in 3D space.
 * Used to track block data like preview or selection without modifying the main voxel data.
 * Each voxel stores an 8-bit value (block index, where 0 = not set).
 * Block indices are 8-bit, allowing up to 256 different block types.
 * 
 * The frame uses a 3D array structure for zero-overhead direct access.
 */
export class VoxelFrame {
  private dimensions: Vector3;
  private data: Uint8Array[][]; // 3D array for direct access: data[x][y][z]
  private empty: boolean = true; // Track whether any voxels are set

  constructor(dimensions: Vector3) {
    this.dimensions = { ...dimensions };
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
   */
  public isSet(x: number, y: number, z: number): boolean {
    if (this.empty) return false;
    return this.data[x][y][z] !== 0;
  }

  /**
   * Get the block value at a given position (0 if not set)
   */
  public get(x: number, y: number, z: number): number {
    if (this.empty) return 0;
    return this.data[x][y][z];
  }

  /**
   * Set a voxel at the given position to a specific block index
   */
  public set(x: number, y: number, z: number, blockIndex: number): void {
    this.data[x][y][z] = blockIndex;
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
   * Resize the frame to new dimensions
   */
  public resize(newDimensions: Vector3): void {
    if (
      newDimensions.x === this.dimensions.x &&
      newDimensions.y === this.dimensions.y &&
      newDimensions.z === this.dimensions.z
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

    // Copy overlapping data
    const minX = Math.min(this.dimensions.x, newDimensions.x);
    const minY = Math.min(this.dimensions.y, newDimensions.y);
    const minZ = Math.min(this.dimensions.z, newDimensions.z);

    for (let x = 0; x < minX; x++) {
      for (let y = 0; y < minY; y++) {
        for (let z = 0; z < minZ; z++) {
          newData[x][y][z] = this.data[x][y][z];
        }
      }
    }

    this.dimensions = { ...newDimensions };
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
   * Create a copy of this frame
   */
  public clone(): VoxelFrame {
    const cloned = new VoxelFrame(this.dimensions);
    
    for (let x = 0; x < this.dimensions.x; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        cloned.data[x][y].set(this.data[x][y]);
      }
    }
    
    cloned.empty = this.empty;
    return cloned;
  }
}

