import type { Vector3 } from "@/state/types";

export class VoxelFrame {
  private dimensions: Vector3;
  private minPos: Vector3;
  private data: Uint8Array;
  private empty: boolean = true;

  constructor(dimensions: Vector3, minPos?: Vector3, data?: Uint8Array) {
    this.dimensions = { ...dimensions };
    this.minPos = minPos ? { ...minPos } : { x: 0, y: 0, z: 0 };
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

  private toIndex(localX: number, localY: number, localZ: number): number {
    return localX * this.dimensions.y * this.dimensions.z + localY * this.dimensions.z + localZ;
  }

  public isEmpty(): boolean {
    return this.empty;
  }

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
    return this.data[this.toIndex(localX, localY, localZ)] !== 0;
  }

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
    return this.data[this.toIndex(localX, localY, localZ)];
  }

  public set(x: number, y: number, z: number, blockIndex: number): void {
    const localX = x - this.minPos.x;
    const localY = y - this.minPos.y;
    const localZ = z - this.minPos.z;
    if (localX < 0 || localX >= this.dimensions.x ||
        localY < 0 || localY >= this.dimensions.y ||
        localZ < 0 || localZ >= this.dimensions.z) {
      return;
    }
    this.data[this.toIndex(localX, localY, localZ)] = blockIndex;
    if (blockIndex !== 0) {
      this.empty = false;
    }
  }

  public getByIndex(index: number): number {
    if (this.empty || index < 0 || index >= this.data.length) return 0;
    return this.data[index];
  }

  public setByIndex(index: number, blockIndex: number): void {
    if (index < 0 || index >= this.data.length) return;
    this.data[index] = blockIndex;
    if (blockIndex !== 0) {
      this.empty = false;
    }
  }

  public isSetByIndex(index: number): boolean {
    if (this.empty || index < 0 || index >= this.data.length) return false;
    return this.data[index] !== 0;
  }

  public clear(): void {
    this.data.fill(0);
    this.empty = true;
  }

  public getDimensions(): Vector3 {
    return { ...this.dimensions };
  }

  public getMinPos(): Vector3 {
    return { ...this.minPos };
  }

  public getMaxPos(): Vector3 {
    return {
      x: this.minPos.x + this.dimensions.x,
      y: this.minPos.y + this.dimensions.y,
      z: this.minPos.z + this.dimensions.z,
    };
  }

  public getData(): Uint8Array {
    return this.data;
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
    if (this.dimensions.x !== other.dimensions.x ||
        this.dimensions.y !== other.dimensions.y ||
        this.dimensions.z !== other.dimensions.z) {
      return false;
    }
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }
    return true;
  }

  public resize(newDimensions: Vector3, newMinPos?: Vector3): void {
    const targetMinPos = newMinPos || this.minPos;
    if (newDimensions.x === this.dimensions.x &&
        newDimensions.y === this.dimensions.y &&
        newDimensions.z === this.dimensions.z &&
        targetMinPos.x === this.minPos.x &&
        targetMinPos.y === this.minPos.y &&
        targetMinPos.z === this.minPos.z) {
      return;
    }

    const newTotal = newDimensions.x * newDimensions.y * newDimensions.z;
    const newData = new Uint8Array(newTotal);
    const newYZ = newDimensions.y * newDimensions.z;

    const overlapMinX = Math.max(this.minPos.x, targetMinPos.x);
    const overlapMinY = Math.max(this.minPos.y, targetMinPos.y);
    const overlapMinZ = Math.max(this.minPos.z, targetMinPos.z);
    const overlapMaxX = Math.min(this.minPos.x + this.dimensions.x, targetMinPos.x + newDimensions.x);
    const overlapMaxY = Math.min(this.minPos.y + this.dimensions.y, targetMinPos.y + newDimensions.y);
    const overlapMaxZ = Math.min(this.minPos.z + this.dimensions.z, targetMinPos.z + newDimensions.z);

    for (let wx = overlapMinX; wx < overlapMaxX; wx++) {
      for (let wy = overlapMinY; wy < overlapMaxY; wy++) {
        for (let wz = overlapMinZ; wz < overlapMaxZ; wz++) {
          const oldIdx = this.toIndex(wx - this.minPos.x, wy - this.minPos.y, wz - this.minPos.z);
          const newIdx = (wx - targetMinPos.x) * newYZ + (wy - targetMinPos.y) * newDimensions.z + (wz - targetMinPos.z);
          newData[newIdx] = this.data[oldIdx];
        }
      }
    }

    this.dimensions = { ...newDimensions };
    this.minPos = { ...targetMinPos };
    this.data = newData;
  }

  public clone(newMinPos?: Vector3, newMaxPos?: Vector3): VoxelFrame {
    if (newMinPos && newMaxPos) {
      const newDimensions = {
        x: newMaxPos.x - newMinPos.x,
        y: newMaxPos.y - newMinPos.y,
        z: newMaxPos.z - newMinPos.z,
      };
      const cloned = new VoxelFrame(newDimensions, newMinPos);
      for (let wx = newMinPos.x; wx < newMaxPos.x; wx++) {
        for (let wy = newMinPos.y; wy < newMaxPos.y; wy++) {
          for (let wz = newMinPos.z; wz < newMaxPos.z; wz++) {
            const value = this.get(wx, wy, wz);
            if (value !== 0) {
              cloned.set(wx, wy, wz, value);
            }
          }
        }
      }
      return cloned;
    }

    const cloned = new VoxelFrame(this.dimensions, this.minPos);
    cloned.data.set(this.data);
    cloned.empty = this.empty;
    return cloned;
  }
}
