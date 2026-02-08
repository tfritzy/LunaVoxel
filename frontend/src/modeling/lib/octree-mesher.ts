import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import { SparseVoxelOctree } from "./sparse-voxel-octree";

export class OctreeMesher {
  private isOccluder(
    octree: SparseVoxelOctree,
    x: number,
    y: number,
    z: number,
    occupancy?: { data: Uint8Array; size: number; planeStride: number }
  ): boolean {
    if (!occupancy) {
      return octree.get(x, y, z) !== 0;
    }
    if (x < 0 || y < 0 || z < 0 || x >= occupancy.size || y >= occupancy.size || z >= occupancy.size) {
      return false;
    }
    const index = x * occupancy.planeStride + y * occupancy.size + z;
    return occupancy.data[index] !== 0;
  }

  private isFaceOccluded(
    leaf: { minPos: { x: number; y: number; z: number }; size: number },
    normal: [number, number, number],
    octree: SparseVoxelOctree,
    occupancy?: { data: Uint8Array; size: number; planeStride: number }
  ): boolean {
    const size = leaf.size;
    if (normal[0] !== 0) {
      const x = normal[0] > 0 ? leaf.minPos.x + size : leaf.minPos.x - 1;
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          if (!this.isOccluder(octree, x, leaf.minPos.y + y, leaf.minPos.z + z, occupancy)) {
            return false;
          }
        }
      }
      return true;
    }

    if (normal[1] !== 0) {
      const y = normal[1] > 0 ? leaf.minPos.y + size : leaf.minPos.y - 1;
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          if (!this.isOccluder(octree, leaf.minPos.x + x, y, leaf.minPos.z + z, occupancy)) {
            return false;
          }
        }
      }
      return true;
    }

    const z = normal[2] > 0 ? leaf.minPos.z + size : leaf.minPos.z - 1;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (!this.isOccluder(octree, leaf.minPos.x + x, leaf.minPos.y + y, z, occupancy)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Precompute an occupancy buffer indexed as x * planeStride + y * size + z,
   * where planeStride = size * size.
   */
  private buildOccupancy(
    octree: SparseVoxelOctree
  ): { data: Uint8Array; size: number; planeStride: number } {
    const size = octree.getSize();
    const planeStride = size * size;
    const data = new Uint8Array(size * planeStride);

    octree.forEachLeaf((leaf) => {
      if (leaf.value === 0) {
        return;
      }
      const startX = leaf.minPos.x;
      const startY = leaf.minPos.y;
      const startZ = leaf.minPos.z;
      const endX = startX + leaf.size;
      const endY = startY + leaf.size;
      const endZ = startZ + leaf.size;
      for (let x = startX; x < endX; x++) {
        const xOffset = x * planeStride;
        for (let y = startY; y < endY; y++) {
          const yOffset = y * size;
          for (let z = startZ; z < endZ; z++) {
            data[xOffset + yOffset + z] = 1;
          }
        }
      }
    });

    return { data, size, planeStride };
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
    const occupancy = enableCulling ? this.buildOccupancy(octree) : undefined;

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

        if (enableCulling && this.isFaceOccluded(leaf, normal, octree, occupancy)) {
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
