import type { Vector3 } from "@/state/types";

export type OctreeLeaf = {
  minPos: Vector3;
  size: number;
  value: number;
};

type OctreeNode = {
  value: number;
  children?: OctreeNode[];
};

const nextPowerOfTwo = (value: number): number => {
  let power = 1;
  while (power < value) {
    power *= 2;
  }
  return power;
};

export class SparseVoxelOctree {
  private size: number;
  private root: OctreeNode;
  private version: number = 0;

  constructor(dimensions: Vector3) {
    this.size = nextPowerOfTwo(
      Math.max(dimensions.x, dimensions.y, dimensions.z)
    );
    this.root = { value: 0 };
  }

  public getSize(): number {
    return this.size;
  }

  public isEmpty(): boolean {
    return !this.root.children && this.root.value === 0;
  }

  public clear(): void {
    this.root = { value: 0 };
    this.version += 1;
  }

  public get(x: number, y: number, z: number): number {
    if (!this.isWithinBounds(x, y, z)) {
      return 0;
    }

    return this.getNodeValue(this.root, 0, 0, 0, this.size, x, y, z);
  }

  public set(x: number, y: number, z: number, value: number): void {
    if (!this.isWithinBounds(x, y, z)) {
      return;
    }

    this.setNodeValue(this.root, 0, 0, 0, this.size, x, y, z, value);
    this.version += 1;
  }

  public setRegion(minPos: Vector3, size: Vector3, value: number): void {
    const maxPos = {
      x: minPos.x + size.x,
      y: minPos.y + size.y,
      z: minPos.z + size.z,
    };

    const clampedMin = {
      x: Math.max(0, minPos.x),
      y: Math.max(0, minPos.y),
      z: Math.max(0, minPos.z),
    };

    const clampedMax = {
      x: Math.min(this.size, maxPos.x),
      y: Math.min(this.size, maxPos.y),
      z: Math.min(this.size, maxPos.z),
    };

    if (
      clampedMin.x >= clampedMax.x ||
      clampedMin.y >= clampedMax.y ||
      clampedMin.z >= clampedMax.z
    ) {
      return;
    }

    this.setRegionNode(
      this.root,
      0,
      0,
      0,
      this.size,
      clampedMin,
      clampedMax,
      value
    );
    this.version += 1;
  }

  public forEachLeaf(callback: (leaf: OctreeLeaf) => void): void {
    this.visitLeaves(this.root, 0, 0, 0, this.size, callback);
  }

  /**
   * Count leaf nodes, optionally including empty (value 0) leaves.
   */
  public countLeaves(includeEmpty: boolean = false): number {
    let count = 0;
    this.forEachLeaf((leaf) => {
      if (includeEmpty || leaf.value !== 0) {
        count += 1;
      }
    });
    return count;
  }

  /**
   * Apply an updater to all leaf values and collapse uniform children.
   */
  public updateValues(updater: (value: number) => number): void {
    this.updateNodeValues(this.root, updater);
    this.version += 1;
  }

  public getVersion(): number {
    return this.version;
  }

  /**
   * Bounds are based on the internal power-of-two size; callers enforce world limits.
   */
  private isWithinBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      y >= 0 &&
      z >= 0 &&
      x < this.size &&
      y < this.size &&
      z < this.size
    );
  }

  private getNodeValue(
    node: OctreeNode,
    minX: number,
    minY: number,
    minZ: number,
    size: number,
    x: number,
    y: number,
    z: number
  ): number {
    if (!node.children || size === 1) {
      return node.value;
    }

    const half = size / 2;
    const childIndex =
      (x >= minX + half ? 1 : 0) |
      (y >= minY + half ? 2 : 0) |
      (z >= minZ + half ? 4 : 0);

    const child = node.children[childIndex];
    if (!child) {
      return node.value;
    }

    const childMinX = minX + (childIndex & 1 ? half : 0);
    const childMinY = minY + (childIndex & 2 ? half : 0);
    const childMinZ = minZ + (childIndex & 4 ? half : 0);

    return this.getNodeValue(
      child,
      childMinX,
      childMinY,
      childMinZ,
      half,
      x,
      y,
      z
    );
  }

  private setNodeValue(
    node: OctreeNode,
    minX: number,
    minY: number,
    minZ: number,
    size: number,
    x: number,
    y: number,
    z: number,
    value: number
  ): void {
    if (size === 1) {
      node.value = value;
      node.children = undefined;
      return;
    }

    if (!node.children && node.value === value) {
      return;
    }

    if (!node.children) {
      node.children = this.createChildren(node.value);
    }

    const half = size / 2;
    const childIndex =
      (x >= minX + half ? 1 : 0) |
      (y >= minY + half ? 2 : 0) |
      (z >= minZ + half ? 4 : 0);

    const childMinX = minX + (childIndex & 1 ? half : 0);
    const childMinY = minY + (childIndex & 2 ? half : 0);
    const childMinZ = minZ + (childIndex & 4 ? half : 0);

    this.setNodeValue(
      node.children[childIndex],
      childMinX,
      childMinY,
      childMinZ,
      half,
      x,
      y,
      z,
      value
    );

    this.tryCollapse(node);
  }

  private setRegionNode(
    node: OctreeNode,
    minX: number,
    minY: number,
    minZ: number,
    size: number,
    regionMin: Vector3,
    regionMax: Vector3,
    value: number
  ): void {
    const maxX = minX + size;
    const maxY = minY + size;
    const maxZ = minZ + size;

    if (
      regionMax.x <= minX ||
      regionMax.y <= minY ||
      regionMax.z <= minZ ||
      regionMin.x >= maxX ||
      regionMin.y >= maxY ||
      regionMin.z >= maxZ
    ) {
      return;
    }

    if (
      regionMin.x <= minX &&
      regionMin.y <= minY &&
      regionMin.z <= minZ &&
      regionMax.x >= maxX &&
      regionMax.y >= maxY &&
      regionMax.z >= maxZ
    ) {
      node.value = value;
      node.children = undefined;
      return;
    }

    if (size === 1) {
      node.value = value;
      node.children = undefined;
      return;
    }

    if (!node.children) {
      node.children = this.createChildren(node.value);
    }

    const half = size / 2;
    for (let index = 0; index < 8; index++) {
      const childMinX = minX + (index & 1 ? half : 0);
      const childMinY = minY + (index & 2 ? half : 0);
      const childMinZ = minZ + (index & 4 ? half : 0);

      this.setRegionNode(
        node.children[index],
        childMinX,
        childMinY,
        childMinZ,
        half,
        regionMin,
        regionMax,
        value
      );
    }

    this.tryCollapse(node);
  }

  private updateNodeValues(
    node: OctreeNode,
    updater: (value: number) => number
  ): void {
    if (!node.children) {
      node.value = updater(node.value);
      return;
    }

    for (const child of node.children) {
      this.updateNodeValues(child, updater);
    }

    this.tryCollapse(node);
  }

  private createChildren(value: number): OctreeNode[] {
    const children: OctreeNode[] = new Array(8);
    for (let i = 0; i < 8; i++) {
      children[i] = { value };
    }
    return children;
  }

  private tryCollapse(node: OctreeNode): void {
    if (!node.children) {
      return;
    }

    const first = node.children[0];
    if (first.children) {
      return;
    }

    for (let i = 1; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.children || child.value !== first.value) {
        return;
      }
    }

    node.value = first.value;
    node.children = undefined;
  }

  private visitLeaves(
    node: OctreeNode,
    minX: number,
    minY: number,
    minZ: number,
    size: number,
    callback: (leaf: OctreeLeaf) => void
  ): void {
    if (!node.children) {
      callback({
        minPos: { x: minX, y: minY, z: minZ },
        size,
        value: node.value,
      });
      return;
    }

    const half = size / 2;
    for (let index = 0; index < 8; index++) {
      const child = node.children[index];
      const childMinX = minX + (index & 1 ? half : 0);
      const childMinY = minY + (index & 2 ? half : 0);
      const childMinZ = minZ + (index & 4 ? half : 0);
      this.visitLeaves(child, childMinX, childMinY, childMinZ, half, callback);
    }
  }
}
