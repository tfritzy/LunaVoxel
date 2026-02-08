import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import { SparseVoxelOctree, type OctreeLeaf } from "./sparse-voxel-octree";

export class OctreeMesher {
  private buildLeafKey(
    x: number,
    y: number,
    z: number,
    leafDepth: number,
    treeDepth: number
  ): number {
    const morton = this.encodeMorton(x, y, z, treeDepth);
    return (leafDepth << 24) | morton;
  }

  private encodeMorton(x: number, y: number, z: number, depth: number): number {
    let code = 0;
    for (let i = 0; i < depth; i++) {
      const mask = 1 << i;
      code |= ((x & mask) !== 0 ? 1 : 0) << (3 * i);
      code |= ((y & mask) !== 0 ? 1 : 0) << (3 * i + 1);
      code |= ((z & mask) !== 0 ? 1 : 0) << (3 * i + 2);
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
      const leafDepth = Math.round(Math.log2(leaf.size));
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

  private lookupNeighborOcclusion(
    x: number,
    y: number,
    z: number,
    size: number,
    treeDepth: number,
    octree: SparseVoxelOctree,
    leafMap?: Map<number, OctreeLeaf>
  ): boolean | null {
    const octreeSize = octree.getSize();
    if (x < 0 || y < 0 || z < 0 || x >= octreeSize || y >= octreeSize || z >= octreeSize) {
      return false;
    }

    if (leafMap) {
      const leafDepth = Math.round(Math.log2(size));
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
    treeDepth?: number
  ): boolean {
    const resolvedTreeDepth = treeDepth ?? Math.round(Math.log2(octree.getSize()));
    const size = leaf.size;
    if (normal[0] !== 0) {
      const neighborX = normal[0] > 0 ? leaf.minPos.x + size : leaf.minPos.x - size;
      const neighborOcclusion = this.lookupNeighborOcclusion(
        neighborX,
        leaf.minPos.y,
        leaf.minPos.z,
        size,
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
      const neighborY = normal[1] > 0 ? leaf.minPos.y + size : leaf.minPos.y - size;
      const neighborOcclusion = this.lookupNeighborOcclusion(
        leaf.minPos.x,
        neighborY,
        leaf.minPos.z,
        size,
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

    const neighborZ = normal[2] > 0 ? leaf.minPos.z + size : leaf.minPos.z - size;
    const neighborOcclusion = this.lookupNeighborOcclusion(
      leaf.minPos.x,
      leaf.minPos.y,
      neighborZ,
      size,
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
    const treeDepth = Math.round(Math.log2(octree.getSize()));
    const leafMap = enableCulling ? this.buildLeafMap(octree, treeDepth) : undefined;

    octree.forEachLeaf((leaf) => {
      if (leaf.value === 0) {
        return;
      }

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
          this.isFaceOccluded(leaf, normal, octree, leafMap, treeDepth)
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
