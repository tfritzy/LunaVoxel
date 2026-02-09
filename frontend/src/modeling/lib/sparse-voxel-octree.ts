export interface VoxelEntry {
  blockType: number;
  invisible: boolean;
  ignoreRaycast: boolean;
}

export class SparseVoxelOctree {
  private data: Map<number, VoxelEntry> = new Map();

  static packKey(x: number, y: number, z: number): number {
    return x | (y << 10) | (z << 20);
  }

  static unpackKey(key: number): [number, number, number] {
    return [key & 0x3ff, (key >> 10) & 0x3ff, (key >> 20) & 0x3ff];
  }

  get(x: number, y: number, z: number): VoxelEntry | null {
    return this.data.get(SparseVoxelOctree.packKey(x, y, z)) ?? null;
  }

  has(x: number, y: number, z: number): boolean {
    return this.data.has(SparseVoxelOctree.packKey(x, y, z));
  }

  set(x: number, y: number, z: number, blockType: number, invisible = false, ignoreRaycast = false): void {
    if (blockType === 0) {
      this.data.delete(SparseVoxelOctree.packKey(x, y, z));
    } else {
      this.data.set(SparseVoxelOctree.packKey(x, y, z), { blockType, invisible, ignoreRaycast });
    }
  }

  delete(x: number, y: number, z: number): void {
    this.data.delete(SparseVoxelOctree.packKey(x, y, z));
  }

  get size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  entries(): IterableIterator<[number, VoxelEntry]> {
    return this.data.entries();
  }

  keys(): IterableIterator<number> {
    return this.data.keys();
  }

  clone(): SparseVoxelOctree {
    const copy = new SparseVoxelOctree();
    for (const [k, v] of this.data) {
      copy.data.set(k, { blockType: v.blockType, invisible: v.invisible, ignoreRaycast: v.ignoreRaycast });
    }
    return copy;
  }

  mergeFrom(other: SparseVoxelOctree): void {
    for (const [k, v] of other.data) {
      if (v.blockType !== 0) {
        this.data.set(k, { blockType: v.blockType, invisible: v.invisible, ignoreRaycast: v.ignoreRaycast });
      }
    }
  }

  setByKey(key: number, blockType: number, invisible = false, ignoreRaycast = false): void {
    if (blockType === 0) {
      this.data.delete(key);
    } else {
      this.data.set(key, { blockType, invisible, ignoreRaycast });
    }
  }
}
