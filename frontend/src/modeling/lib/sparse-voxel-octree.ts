export interface VoxelEntry {
  x: number;
  y: number;
  z: number;
  blockType: number;
  invisible: boolean;
  ignoreRaycast: boolean;
}

type NodeValue = Omit<VoxelEntry, "x" | "y" | "z">;

class OctreeNode {
  value: NodeValue | null;
  children: (OctreeNode | null)[] | null;

  constructor(value: NodeValue | null = null, children: (OctreeNode | null)[] | null = null) {
    this.value = value;
    this.children = children;
  }
}

export class SparseVoxelOctree {
  private static readonly ROOT_SIZE = 1 << 10;
  private root: OctreeNode = new OctreeNode();
  private voxelCount = 0;

  private static valuesEqual(a: NodeValue | null, b: NodeValue | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
      a.blockType === b.blockType &&
      a.invisible === b.invisible &&
      a.ignoreRaycast === b.ignoreRaycast
    );
  }

  get(x: number, y: number, z: number): VoxelEntry | null {
    if (!this.isInBounds(x, y, z)) return null;
    const value = this.getNodeValue(this.root, 0, 0, 0, SparseVoxelOctree.ROOT_SIZE, x, y, z);
    if (!value) return null;
    return { x, y, z, ...value };
  }

  has(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) !== null;
  }

  set(x: number, y: number, z: number, blockType: number, invisible = false, ignoreRaycast = false): void {
    if (blockType === 0) {
      this.delete(x, y, z);
      return;
    }

    if (!this.isInBounds(x, y, z)) return;

    const existing = this.get(x, y, z);
    const nextValue: NodeValue = { blockType, invisible, ignoreRaycast };
    if (existing) {
      if (SparseVoxelOctree.valuesEqual(nextValue, existing)) return;
    } else {
      this.voxelCount += 1;
    }

    this.setNode(this.root, 0, 0, 0, SparseVoxelOctree.ROOT_SIZE, x, y, z, nextValue);
  }

  delete(x: number, y: number, z: number): void {
    if (!this.isInBounds(x, y, z)) return;
    const existing = this.get(x, y, z);
    if (!existing) return;
    this.voxelCount -= 1;
    this.setNode(this.root, 0, 0, 0, SparseVoxelOctree.ROOT_SIZE, x, y, z, null);
  }

  get size(): number {
    return this.voxelCount;
  }

  get nodeCount(): number {
    return this.countNodes(this.root);
  }

  clear(): void {
    this.root = new OctreeNode();
    this.voxelCount = 0;
  }

  *values(): IterableIterator<VoxelEntry> {
    yield* this.iterateNode(this.root, 0, 0, 0, SparseVoxelOctree.ROOT_SIZE);
  }

  clone(): SparseVoxelOctree {
    const copy = new SparseVoxelOctree();
    copy.root = this.cloneNode(this.root);
    copy.voxelCount = this.voxelCount;
    return copy;
  }

  mergeFrom(other: SparseVoxelOctree): void {
    for (const v of other.values()) {
      this.set(v.x, v.y, v.z, v.blockType, v.invisible, v.ignoreRaycast);
    }
  }

  private isInBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      y >= 0 &&
      z >= 0 &&
      x < SparseVoxelOctree.ROOT_SIZE &&
      y < SparseVoxelOctree.ROOT_SIZE &&
      z < SparseVoxelOctree.ROOT_SIZE
    );
  }

  private getNodeValue(
    node: OctreeNode,
    ox: number,
    oy: number,
    oz: number,
    size: number,
    x: number,
    y: number,
    z: number,
  ): NodeValue | null {
    if (node.children === null) {
      return node.value;
    }
    const half = size / 2;
    const idx = (x >= ox + half ? 1 : 0) + (y >= oy + half ? 2 : 0) + (z >= oz + half ? 4 : 0);
    const child = node.children[idx];
    if (!child) return null;
    return this.getNodeValue(
      child,
      ox + (idx & 1 ? half : 0),
      oy + (idx & 2 ? half : 0),
      oz + (idx & 4 ? half : 0),
      half,
      x,
      y,
      z,
    );
  }

  private setNode(
    node: OctreeNode,
    ox: number,
    oy: number,
    oz: number,
    size: number,
    x: number,
    y: number,
    z: number,
    value: NodeValue | null,
  ): void {
    if (size === 1) {
      node.value = value ? { ...value } : null;
      node.children = null;
      return;
    }

    const half = size / 2;
    if (node.children === null) {
      if (node.value) {
        if (value && SparseVoxelOctree.valuesEqual(node.value, value)) return;
        node.children = new Array(8);
        for (let i = 0; i < 8; i++) {
          node.children[i] = new OctreeNode({ ...node.value });
        }
        node.value = null;
      } else {
        node.children = new Array(8).fill(null);
      }
    }

    const idx = (x >= ox + half ? 1 : 0) + (y >= oy + half ? 2 : 0) + (z >= oz + half ? 4 : 0);
    const childOx = ox + (idx & 1 ? half : 0);
    const childOy = oy + (idx & 2 ? half : 0);
    const childOz = oz + (idx & 4 ? half : 0);

    let child = node.children[idx];
    if (!child) {
      child = new OctreeNode();
      node.children[idx] = child;
    }

    this.setNode(child, childOx, childOy, childOz, half, x, y, z, value);
    this.tryCollapse(node);
  }

  private tryCollapse(node: OctreeNode): void {
    const children = node.children;
    if (!children) return;
    let firstValue: NodeValue | null = null;
    let initialized = false;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child?.children) return;
      const childValue = child?.value ?? null;
      if (!initialized) {
        firstValue = childValue;
        initialized = true;
      } else if (!SparseVoxelOctree.valuesEqual(firstValue, childValue)) {
        return;
      }
    }

    node.value = firstValue ? { ...firstValue } : null;
    node.children = null;
  }

  private countNodes(node: OctreeNode): number {
    if (!node.children) return 1;
    let total = 1;
    for (const child of node.children) {
      if (child) total += this.countNodes(child);
    }
    return total;
  }

  private *iterateNode(
    node: OctreeNode,
    ox: number,
    oy: number,
    oz: number,
    size: number,
  ): IterableIterator<VoxelEntry> {
    if (!node.children) {
      if (!node.value || node.value.blockType <= 0) return;
      if (size === 1) {
        yield { x: ox, y: oy, z: oz, ...node.value };
        return;
      }
      for (let x = ox; x < ox + size; x++) {
        for (let y = oy; y < oy + size; y++) {
          for (let z = oz; z < oz + size; z++) {
            yield { x, y, z, ...node.value };
          }
        }
      }
      return;
    }

    const half = size / 2;
    for (let idx = 0; idx < node.children.length; idx++) {
      const child = node.children[idx];
      if (!child) continue;
      const childOx = ox + (idx & 1 ? half : 0);
      const childOy = oy + (idx & 2 ? half : 0);
      const childOz = oz + (idx & 4 ? half : 0);
      yield* this.iterateNode(child, childOx, childOy, childOz, half);
    }
  }

  private cloneNode(node: OctreeNode): OctreeNode {
    const clonedValue = node.value ? { ...node.value } : null;
    if (!node.children) return new OctreeNode(clonedValue);
    const clonedChildren = node.children.map((child) => (child ? this.cloneNode(child) : null));
    return new OctreeNode(clonedValue, clonedChildren);
  }
}
