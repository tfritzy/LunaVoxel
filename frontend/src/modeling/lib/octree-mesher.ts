import { calculateOcclusionLevel, FACE_TANGENTS, OCCLUSION_LEVELS } from "./ambient-occlusion";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import { SparseVoxelOctree } from "./sparse-voxel-octree";

export class OctreeMesher {
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
          const cornerX = vertex[0] > 0 ? leaf.minPos.x + leaf.size : leaf.minPos.x;
          const cornerY = vertex[1] > 0 ? leaf.minPos.y + leaf.size : leaf.minPos.y;
          const cornerZ = vertex[2] > 0 ? leaf.minPos.z + leaf.size : leaf.minPos.z;
          const uAxis = tangents.u[0] !== 0 ? "x" : tangents.u[1] !== 0 ? "y" : "z";
          const vAxis = tangents.v[0] !== 0 ? "x" : tangents.v[1] !== 0 ? "y" : "z";
          const uDir =
            (uAxis === "x" ? cornerX : uAxis === "y" ? cornerY : cornerZ) ===
            (uAxis === "x" ? leaf.minPos.x : uAxis === "y" ? leaf.minPos.y : leaf.minPos.z)
              ? -1
              : 1;
          const vDir =
            (vAxis === "x" ? cornerX : vAxis === "y" ? cornerY : cornerZ) ===
            (vAxis === "x" ? leaf.minPos.x : vAxis === "y" ? leaf.minPos.y : leaf.minPos.z)
              ? -1
              : 1;
          const baseX =
            normal[0] === 1
              ? leaf.minPos.x + leaf.size
              : normal[0] === -1
                ? leaf.minPos.x - 1
                : cornerX;
          const baseY =
            normal[1] === 1
              ? leaf.minPos.y + leaf.size
              : normal[1] === -1
                ? leaf.minPos.y - 1
                : cornerY;
          const baseZ =
            normal[2] === 1
              ? leaf.minPos.z + leaf.size
              : normal[2] === -1
                ? leaf.minPos.z - 1
                : cornerZ;
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
          const occlusion = calculateOcclusionLevel(side1, side2, corner);

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
