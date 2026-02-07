import { calculateOcclusionLevel, FACE_TANGENTS, OCCLUSION_LEVELS } from "./ambient-occlusion";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import { SparseVoxelOctree } from "./sparse-voxel-octree";

export class OctreeMesher {
  /**
   * Resolve which axis a tangent vector aligns with.
   */
  private getAxisFromVector(vector: [number, number, number]): "x" | "y" | "z" {
    if (vector[0] !== 0) return "x";
    if (vector[1] !== 0) return "y";
    return "z";
  }

  /**
   * Compute the neighbor coordinate along a face normal for AO sampling.
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
    isOccluder: (x: number, y: number, z: number) => boolean
  ): number {
    const side1 = isOccluder(
      baseX + uDir * tangents.u[0],
      baseY + uDir * tangents.u[1],
      baseZ + uDir * tangents.u[2]
    );
    const side2 = isOccluder(
      baseX + vDir * tangents.v[0],
      baseY + vDir * tangents.v[1],
      baseZ + vDir * tangents.v[2]
    );
    const corner = isOccluder(
      baseX + uDir * tangents.u[0] + vDir * tangents.v[0],
      baseY + uDir * tangents.u[1] + vDir * tangents.v[1],
      baseZ + uDir * tangents.u[2] + vDir * tangents.v[2]
    );

    return calculateOcclusionLevel(side1, side2, corner);
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
    const isOccluder = (x: number, y: number, z: number) =>
      octree.get(x, y, z) !== 0;

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
        const normal = face.normal;
        const tangents = FACE_TANGENTS[faceIndex];
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
          const uAxis = this.getAxisFromVector(tangents.u);
          const vAxis = this.getAxisFromVector(tangents.v);
          const uCorner =
            uAxis === "x" ? cornerX : uAxis === "y" ? cornerY : cornerZ;
          const vCorner =
            vAxis === "x" ? cornerX : vAxis === "y" ? cornerY : cornerZ;
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
            isOccluder
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
