import type { Vector3 } from "./types";

type OctreeNode = {
  value: number | null;
  children?: OctreeNode[];
};

type VoxelEntry = {
  x: number;
  y: number;
  z: number;
  value: number;
};

const nextPowerOfTwo = (value: number): number => {
  let result = 1;
  while (result < value) {
    result *= 2;
  }
  return result;
};

export class SparseVoxelOctree {
  private root: OctreeNode = { value: 0 };
  private readonly size: number;
  private readonly dimensions: Vector3;
  private version = 0;

  constructor(dimensions: Vector3) {
    this.dimensions = { ...dimensions };
    this.size = nextPowerOfTwo(
      Math.max(dimensions.x, dimensions.y, dimensions.z)
    );
  }

  public getDimensions(): Vector3 {
    return { ...this.dimensions };
  }

  public getVersion(): number {
    return this.version;
  }

  public isEmpty(): boolean {
    return this.root.value === 0 && !this.root.children;
  }

  public clear(): void {
    if (this.isEmpty()) return;
    this.root = { value: 0 };
    this.version += 1;
  }

  public get(x: number, y: number, z: number): number {
    if (!this.isInBounds(x, y, z)) return 0;
    return this.getNode(this.root, this.size, x, y, z);
  }

  public isSet(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) !== 0;
  }

  public set(x: number, y: number, z: number, value: number): void {
    if (!this.isInBounds(x, y, z)) return;
    if (this.get(x, y, z) === value) return;
    this.root = this.setNode(this.root, this.size, x, y, z, value);
    this.version += 1;
  }

  public getByIndex(index: number): number {
    const coords = this.indexToCoords(index);
    if (!coords) return 0;
    return this.get(coords.x, coords.y, coords.z);
  }

  public setByIndex(index: number, value: number): void {
    const coords = this.indexToCoords(index);
    if (!coords) return;
    this.set(coords.x, coords.y, coords.z, value);
  }

  public isSetByIndex(index: number): boolean {
    return this.getByIndex(index) !== 0;
  }

  public forEach(callback: (entry: VoxelEntry) => void): void {
    if (this.isEmpty()) return;
    this.forEachNode(this.root, this.size, 0, 0, 0, callback);
  }

  public every(predicate: (entry: VoxelEntry) => boolean): boolean {
    if (this.isEmpty()) return true;
    return this.everyNode(this.root, this.size, 0, 0, 0, predicate);
  }

  public collectEntries(): VoxelEntry[] {
    const entries: VoxelEntry[] = [];
    this.forEach((entry) => entries.push(entry));
    return entries;
  }

  public clone(): SparseVoxelOctree {
    const cloned = new SparseVoxelOctree(this.dimensions);
    cloned.root = this.cloneNode(this.root);
    cloned.version = this.version;
    return cloned;
  }

  private isInBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      y >= 0 &&
      z >= 0 &&
      x < this.dimensions.x &&
      y < this.dimensions.y &&
      z < this.dimensions.z
    );
  }

  private indexToCoords(index: number): Vector3 | null {
    const sizeYZ = this.dimensions.y * this.dimensions.z;
    const totalSize = this.dimensions.x * sizeYZ;
    if (index < 0 || index >= totalSize) return null;
    const x = Math.floor(index / sizeYZ);
    const y = Math.floor((index % sizeYZ) / this.dimensions.z);
    const z = index % this.dimensions.z;
    return { x, y, z };
  }

  private getNode(
    node: OctreeNode,
    size: number,
    x: number,
    y: number,
    z: number
  ): number {
    if (node.value !== null) return node.value;
    const half = size / 2;
    const index =
      (x >= half ? 1 : 0) + (y >= half ? 2 : 0) + (z >= half ? 4 : 0);
    const child = node.children?.[index];
    if (!child) return 0;
    return this.getNode(
      child,
      half,
      x >= half ? x - half : x,
      y >= half ? y - half : y,
      z >= half ? z - half : z
    );
  }

  private setNode(
    node: OctreeNode,
    size: number,
    x: number,
    y: number,
    z: number,
    value: number
  ): OctreeNode {
    if (size === 1) {
      node.value = value;
      node.children = undefined;
      return node;
    }

    if (node.value !== null) {
      if (node.value === value) return node;
      node.children = this.createChildren(node.value);
      node.value = null;
    }

    if (!node.children) {
      node.children = this.createChildren(0);
    }

    const half = size / 2;
    const index =
      (x >= half ? 1 : 0) + (y >= half ? 2 : 0) + (z >= half ? 4 : 0);
    const child = node.children[index];
    node.children[index] = this.setNode(
      child,
      half,
      x >= half ? x - half : x,
      y >= half ? y - half : y,
      z >= half ? z - half : z,
      value
    );

    const firstChild = node.children[0];
    if (
      firstChild.value !== null &&
      node.children.every((childNode) => childNode.value === firstChild.value)
    ) {
      node.value = firstChild.value;
      node.children = undefined;
    }

    return node;
  }

  private createChildren(value: number): OctreeNode[] {
    return Array.from({ length: 8 }, () => ({ value }));
  }

  private forEachNode(
    node: OctreeNode,
    size: number,
    originX: number,
    originY: number,
    originZ: number,
    callback: (entry: VoxelEntry) => void
  ): void {
    if (node.value !== null) {
      if (node.value === 0) return;
      const maxX = Math.min(originX + size, this.dimensions.x);
      const maxY = Math.min(originY + size, this.dimensions.y);
      const maxZ = Math.min(originZ + size, this.dimensions.z);
      for (let x = originX; x < maxX; x++) {
        for (let y = originY; y < maxY; y++) {
          for (let z = originZ; z < maxZ; z++) {
            callback({ x, y, z, value: node.value });
          }
        }
      }
      return;
    }

    const half = size / 2;
    if (!node.children) return;
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dz = 0; dz < 2; dz++) {
          const index = dx + dy * 2 + dz * 4;
          const child = node.children[index];
          if (!child) continue;
          this.forEachNode(
            child,
            half,
            originX + dx * half,
            originY + dy * half,
            originZ + dz * half,
            callback
          );
        }
      }
    }
  }

  private everyNode(
    node: OctreeNode,
    size: number,
    originX: number,
    originY: number,
    originZ: number,
    predicate: (entry: VoxelEntry) => boolean
  ): boolean {
    if (node.value !== null) {
      if (node.value === 0) return true;
      const maxX = Math.min(originX + size, this.dimensions.x);
      const maxY = Math.min(originY + size, this.dimensions.y);
      const maxZ = Math.min(originZ + size, this.dimensions.z);
      for (let x = originX; x < maxX; x++) {
        for (let y = originY; y < maxY; y++) {
          for (let z = originZ; z < maxZ; z++) {
            if (!predicate({ x, y, z, value: node.value })) {
              return false;
            }
          }
        }
      }
      return true;
    }

    const half = size / 2;
    if (!node.children) return true;
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dz = 0; dz < 2; dz++) {
          const index = dx + dy * 2 + dz * 4;
          const child = node.children[index];
          if (!child) continue;
          if (
            !this.everyNode(
              child,
              half,
              originX + dx * half,
              originY + dy * half,
              originZ + dz * half,
              predicate
            )
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  private cloneNode(node: OctreeNode): OctreeNode {
    if (node.value !== null) {
      return { value: node.value };
    }
    return {
      value: null,
      children: node.children?.map((child) => this.cloneNode(child)),
    };
  }
}
