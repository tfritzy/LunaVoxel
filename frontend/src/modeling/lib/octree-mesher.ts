import { calculateOcclusionLevel, FACE_TANGENTS, OCCLUSION_LEVELS } from "./ambient-occlusion";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import { SparseVoxelOctree } from "./sparse-voxel-octree";

export class OctreeMesher {
  private faceTangentAxes: { uAxis: "x" | "y" | "z"; vAxis: "x" | "y" | "z" }[];

  constructor() {
    this.faceTangentAxes = FACE_TANGENTS.map((tangent) => ({
      uAxis: this.getAxisFromVector(tangent.u),
      vAxis: this.getAxisFromVector(tangent.v),
    }));
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
   * @param normalComponent The normal component (-1, 0, 1) for the face axis.
   * @param minCoord The leaf minimum coordinate on that axis.
   * @param size The leaf size along that axis.
   * @param cornerCoord The vertex corner coordinate when the face is perpendicular.
   */
  private getBaseCoord(
    normalComponent: number,
    minCoord: number,
    size: number,
    cornerCoord: number
  ): number {
    if (normalComponent === 1) return minCoord + size;
    if (normalComponent === -1) return minCoord - 1;
    return cornerCoord;
  }

  /**
   * Map a vertex component to its corner coordinate for the leaf bounds.
   */
  private getCornerCoord(
    component: number,
    minCoord: number,
    size: number
  ): number {
    return component > 0 ? minCoord + size : minCoord;
  }

  /**
   * Select the corner coordinate for a specific axis.
   */
  private getCoordForAxis(
    axis: "x" | "y" | "z",
    cornerX: number,
    cornerY: number,
    cornerZ: number
  ): number {
    return axis === "x" ? cornerX : axis === "y" ? cornerY : cornerZ;
  }

  /**
   * Determine the sign (+/-) for AO sampling along the tangent axis.
   */
  private getDirectionFromCorner(
    axis: "x" | "y" | "z",
    cornerCoord: number,
    minPos: { x: number; y: number; z: number }
  ): number {
    const minCoord = axis === "x" ? minPos.x : axis === "y" ? minPos.y : minPos.z;
    return cornerCoord === minCoord ? -1 : 1;
  }

  /**
   * Check side and corner occluders to compute AO level for a vertex corner.
   */
  private getOcclusionLevel(
    baseX: number,
    baseY: number,
    baseZ: number,
    uDir: number,
    vDir: number,
    tangents: { u: [number, number, number]; v: [number, number, number] },
    octree: SparseVoxelOctree
  ): number {
    const side1 = this.isOccluder(
      octree,
      baseX + uDir * tangents.u[0],
      baseY + uDir * tangents.u[1],
      baseZ + uDir * tangents.u[2]
    );
    const side2 = this.isOccluder(
      octree,
      baseX + vDir * tangents.v[0],
      baseY + vDir * tangents.v[1],
      baseZ + vDir * tangents.v[2]
    );
    const corner = this.isOccluder(
      octree,
      baseX + uDir * tangents.u[0] + vDir * tangents.v[0],
      baseY + uDir * tangents.u[1] + vDir * tangents.v[1],
      baseZ + uDir * tangents.u[2] + vDir * tangents.v[2]
    );

    return calculateOcclusionLevel(side1, side2, corner);
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
    octree: SparseVoxelOctree
  ): boolean {
    const size = leaf.size;
    if (normal[0] !== 0) {
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
    isSelected: (value: number) => number = () => 0
  ): void {
    meshArrays.reset();

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
        const tangents = FACE_TANGENTS[faceIndex];
        const { uAxis, vAxis } = this.faceTangentAxes[faceIndex];

        if (this.isFaceOccluded(leaf, normal, octree)) {
          continue;
        }

        const startVertexIndex = meshArrays.vertexCount;

        for (let vi = 0; vi < 4; vi++) {
          const vertex = face.vertices[vi];
          const vx = centerX + vertex[0] * leaf.size;
          const vy = centerY + vertex[1] * leaf.size;
          const vz = centerZ + vertex[2] * leaf.size;
          const cornerX = this.getCornerCoord(
            vertex[0],
            leaf.minPos.x,
            leaf.size
          );
          const cornerY = this.getCornerCoord(
            vertex[1],
            leaf.minPos.y,
            leaf.size
          );
          const cornerZ = this.getCornerCoord(
            vertex[2],
            leaf.minPos.z,
            leaf.size
          );
          const uCorner = this.getCoordForAxis(uAxis, cornerX, cornerY, cornerZ);
          const vCorner = this.getCoordForAxis(vAxis, cornerX, cornerY, cornerZ);
          const uDir = this.getDirectionFromCorner(uAxis, uCorner, leaf.minPos);
          const vDir = this.getDirectionFromCorner(vAxis, vCorner, leaf.minPos);
          const baseX = this.getBaseCoord(
            normal[0],
            leaf.minPos.x,
            leaf.size,
            cornerX
          );
          const baseY = this.getBaseCoord(
            normal[1],
            leaf.minPos.y,
            leaf.size,
            cornerY
          );
          const baseZ = this.getBaseCoord(
            normal[2],
            leaf.minPos.z,
            leaf.size,
            cornerZ
          );
          const occlusion = this.getOcclusionLevel(
            baseX,
            baseY,
            baseZ,
            uDir,
            vDir,
            tangents,
            octree
          );

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
