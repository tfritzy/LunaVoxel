import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import { SparseVoxelOctree, type OctreeLeaf } from "./sparse-voxel-octree";

export class OctreeMesher {
  // size is expected to be a power of two for octree leaves.
  private getLog2OfSize(size: number): number {
    return 31 - Math.clz32(size);
  }

  private buildLeafKey(
    x: number,
    y: number,
    z: number,
    leafDepth: number,
    treeDepth: number
  ): number {
    const morton = this.encodeMorton(x, y, z, treeDepth);
    const shift = treeDepth * 3;
    return (leafDepth << shift) | morton;
  }

  private encodeMorton(x: number, y: number, z: number, depth: number): number {
    let code = 0;
    for (let i = 0; i < depth; i++) {
      const shift = 3 * i;
      code |= ((x >> i) & 1) << shift;
      code |= ((y >> i) & 1) << (shift + 1);
      code |= ((z >> i) & 1) << (shift + 2);
    }
    return code;
  }

  private buildLeafMap(
    octree: SparseVoxelOctree,
    treeDepth: number
  ): Map<number, OctreeLeaf> {
    const leafMap = new Map<number, OctreeLeaf>();
    octree.forEachLeaf((leaf) => {
      if (leaf.value === 0) {
        return;
      }
      if (leaf.size <= 1) {
        // Size-1 leaves are handled via direct octree.get lookups in neighbor checks.
        return;
      }
      const leafDepth = this.getLog2OfSize(leaf.size);
      const key = this.buildLeafKey(
        leaf.minPos.x,
        leaf.minPos.y,
        leaf.minPos.z,
        leafDepth,
        treeDepth
      );
      leafMap.set(key, leaf);
    });
    return leafMap;
  }

  /**
   * Returns true if the neighbor is definitively occluding, false if definitively empty,
   * or null if the neighbor is partially filled and requires per-voxel checks.
   */
  private lookupNeighborOcclusion(
    x: number,
    y: number,
    z: number,
    size: number,
    leafDepth: number,
    treeDepth: number,
    octree: SparseVoxelOctree,
    leafMap?: Map<number, OctreeLeaf>
  ): boolean | null {
    const octreeSize = octree.getSize();
    // SparseVoxelOctree is cubic based on its power-of-two size.
    if (x < 0 || y < 0 || z < 0 || x >= octreeSize || y >= octreeSize || z >= octreeSize) {
      return false;
    }

    if (leafDepth === 0) {
      return octree.get(x, y, z) !== 0;
    }

    if (leafMap) {
      const key = this.buildLeafKey(x, y, z, leafDepth, treeDepth);
      const neighbor = leafMap.get(key);
      if (neighbor) {
        return neighbor.value !== 0;
      }
    }

    if (octree.get(x, y, z) === 0) {
      return false;
    }

    return null;
  }

  private getNeighborPosition(
    minCoord: number,
    size: number,
    normalComponent: number
  ): number {
    return normalComponent > 0 ? minCoord + size : minCoord - size;
  }

  private isOccluder(
    octree: SparseVoxelOctree,
    x: number,
    y: number,
    z: number
  ): boolean {
    return octree.get(x, y, z) !== 0;
  }

  private isFaceOccluded(
    leaf: { minPos: { x: number; y: number; z: number }; size: number },
    normal: [number, number, number],
    octree: SparseVoxelOctree,
    leafMap?: Map<number, OctreeLeaf>,
    leafDepth?: number,
    treeDepth?: number
  ): boolean {
    const resolvedLeafDepth = leafDepth ?? this.getLog2OfSize(leaf.size);
    const resolvedTreeDepth = treeDepth ?? this.getLog2OfSize(octree.getSize());
    const size = leaf.size;
    if (normal[0] !== 0) {
      const neighborX = this.getNeighborPosition(
        leaf.minPos.x,
        size,
        normal[0]
      );
      const neighborOcclusion = this.lookupNeighborOcclusion(
        neighborX,
        leaf.minPos.y,
        leaf.minPos.z,
        size,
        resolvedLeafDepth,
        resolvedTreeDepth,
        octree,
        leafMap
      );
      if (neighborOcclusion !== null) {
        return neighborOcclusion;
      }
      const x = normal[0] > 0 ? leaf.minPos.x + size : leaf.minPos.x - 1;
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          if (!this.isOccluder(octree, x, leaf.minPos.y + y, leaf.minPos.z + z)) {
            return false;
          }
        }
      }
      return true;
    }

    if (normal[1] !== 0) {
      const neighborY = this.getNeighborPosition(
        leaf.minPos.y,
        size,
        normal[1]
      );
      const neighborOcclusion = this.lookupNeighborOcclusion(
        leaf.minPos.x,
        neighborY,
        leaf.minPos.z,
        size,
        resolvedLeafDepth,
        resolvedTreeDepth,
        octree,
        leafMap
      );
      if (neighborOcclusion !== null) {
        return neighborOcclusion;
      }
      const y = normal[1] > 0 ? leaf.minPos.y + size : leaf.minPos.y - 1;
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          if (!this.isOccluder(octree, leaf.minPos.x + x, y, leaf.minPos.z + z)) {
            return false;
          }
        }
      }
      return true;
    }

    const neighborZ = this.getNeighborPosition(
      leaf.minPos.z,
      size,
      normal[2]
    );
    const neighborOcclusion = this.lookupNeighborOcclusion(
      leaf.minPos.x,
      leaf.minPos.y,
      neighborZ,
      size,
      resolvedLeafDepth,
      resolvedTreeDepth,
      octree,
      leafMap
    );
    if (neighborOcclusion !== null) {
      return neighborOcclusion;
    }
    const z = normal[2] > 0 ? leaf.minPos.z + size : leaf.minPos.z - 1;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (!this.isOccluder(octree, leaf.minPos.x + x, leaf.minPos.y + y, z)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Build brute-force meshes for each leaf; isSelected maps a voxel value to 0/1.
   */
  public buildMesh(
    octree: SparseVoxelOctree,
    textureWidth: number,
    blockAtlasMappings: number[][],
    meshArrays: MeshArrays,
    isSelected: (value: number) => number = () => 0,
    options?: {
      enableAO?: boolean;
      enableCulling?: boolean;
    }
  ): void {
    meshArrays.reset();
    const enableCulling = options?.enableCulling ?? true;
    const treeDepth = this.getLog2OfSize(octree.getSize());
    const leafMap = enableCulling ? this.buildLeafMap(octree, treeDepth) : undefined;

    octree.forEachLeaf((leaf) => {
      if (leaf.value === 0) {
        return;
      }
      const leafDepth = this.getLog2OfSize(leaf.size);

      const blockType = Math.max(leaf.value, 1);
      const faceTextures = blockAtlasMappings[blockType - 1];
      if (!faceTextures) {
        return;
      }

      const halfSize = leaf.size / 2;
      const centerX = leaf.minPos.x + halfSize;
      const centerY = leaf.minPos.y + halfSize;
      const centerZ = leaf.minPos.z + halfSize;
      const selectedFlag = isSelected(leaf.value);

      for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
        const face = faces[faceIndex];
        const textureIndex = faceTextures[faceIndex];
        const textureCoords = getTextureCoordinates(textureIndex, textureWidth);
        const normal = face.normal as [number, number, number];

        if (
          enableCulling &&
          this.isFaceOccluded(leaf, normal, octree, leafMap, leafDepth, treeDepth)
        ) {
          continue;
        }

        const startVertexIndex = meshArrays.vertexCount;

        for (let vi = 0; vi < 4; vi++) {
          const vertex = face.vertices[vi];
          const vx = centerX + vertex[0] * leaf.size;
          const vy = centerY + vertex[1] * leaf.size;
          const vz = centerZ + vertex[2] * leaf.size;

          meshArrays.pushVertex(vx, vy, vz);
          meshArrays.pushNormal(normal[0], normal[1], normal[2]);
          meshArrays.pushUV(
            textureCoords[vi * 2],
            textureCoords[vi * 2 + 1]
          );
          meshArrays.pushAO(1);
          meshArrays.pushIsSelected(selectedFlag);
          meshArrays.incrementVertex();
        }

        meshArrays.pushIndex(startVertexIndex);
        meshArrays.pushIndex(startVertexIndex + 1);
        meshArrays.pushIndex(startVertexIndex + 2);
        meshArrays.pushIndex(startVertexIndex);
        meshArrays.pushIndex(startVertexIndex + 2);
        meshArrays.pushIndex(startVertexIndex + 3);
      }
    });
  }
}
