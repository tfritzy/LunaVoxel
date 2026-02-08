export const PREVIEW_ERASE_SENTINEL = 255;

export class SparseVoxelOctree {
  private data: Map<number, number> = new Map();

  static packKey(x: number, y: number, z: number): number {
    return x | (y << 10) | (z << 20);
  }

  static unpackKey(key: number): [number, number, number] {
    return [key & 0x3ff, (key >> 10) & 0x3ff, (key >> 20) & 0x3ff];
  }

  get(x: number, y: number, z: number): number {
    return this.data.get(SparseVoxelOctree.packKey(x, y, z)) ?? 0;
  }

  has(x: number, y: number, z: number): boolean {
    return this.data.has(SparseVoxelOctree.packKey(x, y, z));
  }

  set(x: number, y: number, z: number, value: number): void {
    if (value === 0) {
      this.data.delete(SparseVoxelOctree.packKey(x, y, z));
    } else {
      this.data.set(SparseVoxelOctree.packKey(x, y, z), value);
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

  entries(): IterableIterator<[number, number]> {
    return this.data.entries();
  }

  keys(): IterableIterator<number> {
    return this.data.keys();
  }

  clone(): SparseVoxelOctree {
    const copy = new SparseVoxelOctree();
    for (const [k, v] of this.data) {
      copy.data.set(k, v);
    }
    return copy;
  }

  mergeFrom(other: SparseVoxelOctree): void {
    for (const [k, v] of other.data) {
      if (v !== 0) {
        this.data.set(k, v);
      }
    }
  }

  hasKey(key: number): boolean {
    return this.data.has(key);
  }

  getByKey(key: number): number {
    return this.data.get(key) ?? 0;
  }

  setByKey(key: number, value: number): void {
    if (value === 0) {
      this.data.delete(key);
    } else {
      this.data.set(key, value);
    }
  }
}
