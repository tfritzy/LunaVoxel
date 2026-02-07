import { calculateOcclusionLevel, FACE_TANGENTS, OCCLUSION_LEVELS } from "./ambient-occlusion";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import { SparseVoxelOctree } from "./sparse-voxel-octree";

type CornerOffsets = {
  cornerOffset: [number, number, number];
  side1Offset: [number, number, number];
  side2Offset: [number, number, number];
  cornerOffsetVec: [number, number, number];
};

type FacePrecompute = {
  normal: [number, number, number];
  corners: CornerOffsets[];
};

export class OctreeMesher {
  private faceData: FacePrecompute[];

  constructor() {
    const axisIndex = { x: 0, y: 1, z: 2 } as const;
    this.faceData = faces.map((face, faceIndex) => {
      const normal = face.normal as [number, number, number];
      const tangents = FACE_TANGENTS[faceIndex];
      const uAxis = this.getAxisFromVector(tangents.u);
      const vAxis = this.getAxisFromVector(tangents.v);
      const uIndex = axisIndex[uAxis];
      const vIndex = axisIndex[vAxis];
      const corners = face.vertices.map((vertex) => {
        const cornerOffset: [number, number, number] = [
          vertex[0] > 0 ? 1 : 0,
          vertex[1] > 0 ? 1 : 0,
          vertex[2] > 0 ? 1 : 0,
        ];
        const side1Direction = cornerOffset[uIndex] === 0 ? -1 : 1;
        const side2Direction = cornerOffset[vIndex] === 0 ? -1 : 1;
        const side1Offset: [number, number, number] = [
          tangents.u[0] * side1Direction,
          tangents.u[1] * side1Direction,
          tangents.u[2] * side1Direction,
        ];
        const side2Offset: [number, number, number] = [
          tangents.v[0] * side2Direction,
          tangents.v[1] * side2Direction,
          tangents.v[2] * side2Direction,
        ];
        const cornerOffsetVec: [number, number, number] = [
          side1Offset[0] + side2Offset[0],
          side1Offset[1] + side2Offset[1],
          side1Offset[2] + side2Offset[2],
        ];
        return {
          cornerOffset,
          side1Offset,
          side2Offset,
          cornerOffsetVec,
        };
      });
      return {
        normal,
        corners,
      };
    });
  }

  /**
   * Resolve which axis a tangent vector aligns with (expects a single non-zero component).
   */
  private getAxisFromVector(vector: [number, number, number]): "x" | "y" | "z" {
    if (vector[0] !== 0) return "x";
    if (vector[1] !== 0) return "y";
    return "z";
  }

  /**
   * Compute the AO sampling coordinate along a face normal.
   */
  private getBaseCoord(
    normalComponent: number,
    minCoord: number,
    size: number,
    cornerCoord: number
  ): number {
    if (normalComponent === 0) {
      return cornerCoord;
    }
    return minCoord + (normalComponent === 1 ? size : -1);
  }

  /**
   * Check side and corner occluders to compute AO level for a vertex corner.
   */
  private getOcclusionLevel(
    baseX: number,
    baseY: number,
    baseZ: number,
    corner: CornerOffsets,
    octree: SparseVoxelOctree,
    occupancy?: { data: Uint8Array; size: number; planeStride: number }
  ): number {
    const side1 = this.isOccluder(
      octree,
      baseX + corner.side1Offset[0],
      baseY + corner.side1Offset[1],
      baseZ + corner.side1Offset[2],
      occupancy
    );
    const side2 = this.isOccluder(
      octree,
      baseX + corner.side2Offset[0],
      baseY + corner.side2Offset[1],
      baseZ + corner.side2Offset[2],
      occupancy
    );
    const diagonalOcclusion = this.isOccluder(
      octree,
      baseX + corner.cornerOffsetVec[0],
      baseY + corner.cornerOffsetVec[1],
      baseZ + corner.cornerOffsetVec[2],
      occupancy
    );

    return calculateOcclusionLevel(side1, side2, diagonalOcclusion);
  }

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
    const enableAO = options?.enableAO ?? true;
    const enableCulling = options?.enableCulling ?? true;
    const occupancy = enableAO || enableCulling ? this.buildOccupancy(octree) : undefined;

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
        const faceInfo = this.faceData[faceIndex];
        const normal = faceInfo.normal;

        if (enableCulling && this.isFaceOccluded(leaf, normal, octree, occupancy)) {
          continue;
        }

        const startVertexIndex = meshArrays.vertexCount;

        for (let vi = 0; vi < 4; vi++) {
          const vertex = face.vertices[vi];
          const vx = centerX + vertex[0] * leaf.size;
          const vy = centerY + vertex[1] * leaf.size;
          const vz = centerZ + vertex[2] * leaf.size;
          const corner = faceInfo.corners[vi];
          const cornerX = leaf.minPos.x + corner.cornerOffset[0] * leaf.size;
          const cornerY = leaf.minPos.y + corner.cornerOffset[1] * leaf.size;
          const cornerZ = leaf.minPos.z + corner.cornerOffset[2] * leaf.size;
          const baseX = this.getBaseCoord(
            faceInfo.normal[0],
            leaf.minPos.x,
            leaf.size,
            cornerX
          );
          const baseY = this.getBaseCoord(
            faceInfo.normal[1],
            leaf.minPos.y,
            leaf.size,
            cornerY
          );
          const baseZ = this.getBaseCoord(
            faceInfo.normal[2],
            leaf.minPos.z,
            leaf.size,
            cornerZ
          );
          const occlusion = enableAO
            ? this.getOcclusionLevel(
                baseX,
                baseY,
                baseZ,
                corner,
                octree,
                occupancy
              )
            : 0;

          meshArrays.pushVertex(vx, vy, vz);
          meshArrays.pushNormal(normal[0], normal[1], normal[2]);
          meshArrays.pushUV(
            textureCoords[vi * 2],
            textureCoords[vi * 2 + 1]
          );
          meshArrays.pushAO(OCCLUSION_LEVELS[occlusion]);
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
