export interface VoxelEntry {
  x: number;
  y: number;
  z: number;
  blockType: number;
  invisible: boolean;
  ignoreRaycast: boolean;
}

export class SparseVoxelOctree {
  private data: Map<number, VoxelEntry> = new Map();

  private static key(x: number, y: number, z: number): number {
    return x | (y << 10) | (z << 20);
  }

  get(x: number, y: number, z: number): VoxelEntry | null {
    return this.data.get(SparseVoxelOctree.key(x, y, z)) ?? null;
  }

  has(x: number, y: number, z: number): boolean {
    return this.data.has(SparseVoxelOctree.key(x, y, z));
  }

  set(x: number, y: number, z: number, blockType: number, invisible = false, ignoreRaycast = false): void {
    const k = SparseVoxelOctree.key(x, y, z);
    if (blockType === 0) {
      this.data.delete(k);
    } else {
      this.data.set(k, { x, y, z, blockType, invisible, ignoreRaycast });
    }
  }

  delete(x: number, y: number, z: number): void {
    this.data.delete(SparseVoxelOctree.key(x, y, z));
  }

  get size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  values(): IterableIterator<VoxelEntry> {
    return this.data.values();
  }

  clone(): SparseVoxelOctree {
    const copy = new SparseVoxelOctree();
    for (const v of this.data.values()) {
      copy.data.set(SparseVoxelOctree.key(v.x, v.y, v.z), { ...v });
    }
    return copy;
  }

  mergeFrom(other: SparseVoxelOctree): void {
    for (const v of other.data.values()) {
      if (v.blockType !== 0) {
        this.data.set(SparseVoxelOctree.key(v.x, v.y, v.z), { ...v });
      }
    }
  }
}
