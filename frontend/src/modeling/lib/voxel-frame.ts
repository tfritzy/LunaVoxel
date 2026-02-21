import type { Vector3 } from "@/state/types";

/**
 * Uses a 1D Uint8Array for voxel data storage.
 * Internally uses capacity-based allocation (like ArrayList) to reduce
 * reallocations when the frame is resized incrementally.
 */
let nextVoxelFrameVersion = 0;

export class VoxelFrame {
  private dimensions: Vector3;
  private minPos: Vector3;
  private capDimensions: Vector3;
  private capMinPos: Vector3;
  private data: Uint8Array;
  private empty: boolean = true;
  private version: number = nextVoxelFrameVersion++;

  constructor(dimensions: Vector3, minPos?: Vector3, data?: Uint8Array) {
    this.dimensions = { ...dimensions };
    this.minPos = minPos ? { ...minPos } : { x: 0, y: 0, z: 0 };
    this.capDimensions = { ...this.dimensions };
    this.capMinPos = { ...this.minPos };
    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    
    if (data) {
      this.data = data;
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

  public getVersion(): number {
    return this.version;
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
    const capLocalX = x - this.capMinPos.x;
    const capLocalY = y - this.capMinPos.y;
    const capLocalZ = z - this.capMinPos.z;
    const index = capLocalX * this.capDimensions.y * this.capDimensions.z + capLocalY * this.capDimensions.z + capLocalZ;
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
    const capLocalX = x - this.capMinPos.x;
    const capLocalY = y - this.capMinPos.y;
    const capLocalZ = z - this.capMinPos.z;
    const index = capLocalX * this.capDimensions.y * this.capDimensions.z + capLocalY * this.capDimensions.z + capLocalZ;
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
    const capLocalX = x - this.capMinPos.x;
    const capLocalY = y - this.capMinPos.y;
    const capLocalZ = z - this.capMinPos.z;
    const index = capLocalX * this.capDimensions.y * this.capDimensions.z + capLocalY * this.capDimensions.z + capLocalZ;
    this.data[index] = blockIndex;
    if (blockIndex !== 0) {
      this.empty = false;
    }
    this.version++;
  }

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
    this.version++;
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
    this.version++;
  }

  public fill(value: number): void {
    if (
      this.dimensions.x === this.capDimensions.x &&
      this.dimensions.y === this.capDimensions.y &&
      this.dimensions.z === this.capDimensions.z &&
      this.minPos.x === this.capMinPos.x &&
      this.minPos.y === this.capMinPos.y &&
      this.minPos.z === this.capMinPos.z
    ) {
      this.data.fill(value);
    } else {
      const offX = this.minPos.x - this.capMinPos.x;
      const offY = this.minPos.y - this.capMinPos.y;
      const offZ = this.minPos.z - this.capMinPos.z;
      const capYZ = this.capDimensions.y * this.capDimensions.z;
      const capZ = this.capDimensions.z;
      for (let lx = 0; lx < this.dimensions.x; lx++) {
        for (let ly = 0; ly < this.dimensions.y; ly++) {
          const rowStart = (lx + offX) * capYZ + (ly + offY) * capZ + offZ;
          this.data.fill(value, rowStart, rowStart + this.dimensions.z);
        }
      }
    }
    this.empty = value === 0;
    this.version++;
  }

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

    const newMaxX = targetMinPos.x + newDimensions.x;
    const newMaxY = targetMinPos.y + newDimensions.y;
    const newMaxZ = targetMinPos.z + newDimensions.z;
    const capMaxX = this.capMinPos.x + this.capDimensions.x;
    const capMaxY = this.capMinPos.y + this.capDimensions.y;
    const capMaxZ = this.capMinPos.z + this.capDimensions.z;

    const fitsInCapacity =
      targetMinPos.x >= this.capMinPos.x && newMaxX <= capMaxX &&
      targetMinPos.y >= this.capMinPos.y && newMaxY <= capMaxY &&
      targetMinPos.z >= this.capMinPos.z && newMaxZ <= capMaxZ;

    if (!fitsInCapacity) {
      const reqMinX = Math.min(this.capMinPos.x, targetMinPos.x);
      const reqMinY = Math.min(this.capMinPos.y, targetMinPos.y);
      const reqMinZ = Math.min(this.capMinPos.z, targetMinPos.z);
      const reqMaxX = Math.max(capMaxX, newMaxX);
      const reqMaxY = Math.max(capMaxY, newMaxY);
      const reqMaxZ = Math.max(capMaxZ, newMaxZ);
      const reqDimX = reqMaxX - reqMinX;
      const reqDimY = reqMaxY - reqMinY;
      const reqDimZ = reqMaxZ - reqMinZ;

      const newCapDimX = Math.max(reqDimX, this.capDimensions.x * 2);
      const newCapDimY = Math.max(reqDimY, this.capDimensions.y * 2);
      const newCapDimZ = Math.max(reqDimZ, this.capDimensions.z * 2);

      const padX = newCapDimX - reqDimX;
      const padY = newCapDimY - reqDimY;
      const padZ = newCapDimZ - reqDimZ;
      const newCapMinX = reqMinX - Math.floor(padX / 2);
      const newCapMinY = reqMinY - Math.floor(padY / 2);
      const newCapMinZ = reqMinZ - Math.floor(padZ / 2);

      const newCapDimensions = { x: newCapDimX, y: newCapDimY, z: newCapDimZ };
      const newCapMinPos = { x: newCapMinX, y: newCapMinY, z: newCapMinZ };
      const newData = new Uint8Array(newCapDimX * newCapDimY * newCapDimZ);

      if (!this.empty) {
        const overlapMinX = Math.max(this.minPos.x, newCapMinPos.x);
        const overlapMinY = Math.max(this.minPos.y, newCapMinPos.y);
        const overlapMinZ = Math.max(this.minPos.z, newCapMinPos.z);
        const overlapMaxX = Math.min(this.minPos.x + this.dimensions.x, newCapMinPos.x + newCapDimX);
        const overlapMaxY = Math.min(this.minPos.y + this.dimensions.y, newCapMinPos.y + newCapDimY);
        const overlapMaxZ = Math.min(this.minPos.z + this.dimensions.z, newCapMinPos.z + newCapDimZ);

        for (let worldX = overlapMinX; worldX < overlapMaxX; worldX++) {
          for (let worldY = overlapMinY; worldY < overlapMaxY; worldY++) {
            for (let worldZ = overlapMinZ; worldZ < overlapMaxZ; worldZ++) {
              const oldCapX = worldX - this.capMinPos.x;
              const oldCapY = worldY - this.capMinPos.y;
              const oldCapZ = worldZ - this.capMinPos.z;
              const newCapX = worldX - newCapMinPos.x;
              const newCapY = worldY - newCapMinPos.y;
              const newCapZ = worldZ - newCapMinPos.z;
              const oldIndex = oldCapX * this.capDimensions.y * this.capDimensions.z + oldCapY * this.capDimensions.z + oldCapZ;
              const newIndex = newCapX * newCapDimensions.y * newCapDimensions.z + newCapY * newCapDimensions.z + newCapZ;
              newData[newIndex] = this.data[oldIndex];
            }
          }
        }
      }

      this.data = newData;
      this.capDimensions = newCapDimensions;
      this.capMinPos = newCapMinPos;
    }

    this.dimensions = { ...newDimensions };
    this.minPos = { ...targetMinPos };
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

    const dimY = this.dimensions.y;
    const dimZ = this.dimensions.z;
    const thisOffX = this.minPos.x - this.capMinPos.x;
    const thisOffY = this.minPos.y - this.capMinPos.y;
    const thisOffZ = this.minPos.z - this.capMinPos.z;
    const otherOffX = other.minPos.x - other.capMinPos.x;
    const otherOffY = other.minPos.y - other.capMinPos.y;
    const otherOffZ = other.minPos.z - other.capMinPos.z;
    const thisCapYZ = this.capDimensions.y * this.capDimensions.z;
    const thisCapZ = this.capDimensions.z;
    const otherCapYZ = other.capDimensions.y * other.capDimensions.z;
    const otherCapZ = other.capDimensions.z;

    for (let lx = 0; lx < this.dimensions.x; lx++) {
      for (let ly = 0; ly < dimY; ly++) {
        for (let lz = 0; lz < dimZ; lz++) {
          const thisIdx = (lx + thisOffX) * thisCapYZ + (ly + thisOffY) * thisCapZ + (lz + thisOffZ);
          const otherIdx = (lx + otherOffX) * otherCapYZ + (ly + otherOffY) * otherCapZ + (lz + otherOffZ);
          if (this.data[thisIdx] !== other.data[otherIdx]) return false;
        }
      }
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
      const newData = new Uint8Array(this.dimensions.x * this.dimensions.y * this.dimensions.z);
      for (let lx = 0; lx < this.dimensions.x; lx++) {
        for (let ly = 0; ly < this.dimensions.y; ly++) {
          for (let lz = 0; lz < this.dimensions.z; lz++) {
            const capX = lx + this.minPos.x - this.capMinPos.x;
            const capY = ly + this.minPos.y - this.capMinPos.y;
            const capZ = lz + this.minPos.z - this.capMinPos.z;
            const srcIndex = capX * this.capDimensions.y * this.capDimensions.z + capY * this.capDimensions.z + capZ;
            const dstIndex = lx * this.dimensions.y * this.dimensions.z + ly * this.dimensions.z + lz;
            newData[dstIndex] = this.data[srcIndex];
          }
        }
      }
      return new VoxelFrame(this.dimensions, this.minPos, newData);
    }
  }
}
