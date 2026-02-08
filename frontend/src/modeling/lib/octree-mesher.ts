import { SparseVoxelOctree, PREVIEW_ERASE_SENTINEL } from "./sparse-voxel-octree";
import { getTextureCoordinates } from "./texture-coords";
import { faces } from "./voxel-constants";
import { MeshArrays } from "./mesh-arrays";

export class OctreeMesher {
  private occupancy: Uint8Array | null = null;
  private occSizeX = 0;
  private occSizeY = 0;
  private occSizeZ = 0;

  buildMesh(
    octree: SparseVoxelOctree,
    textureWidth: number,
    blockAtlasMappings: number[][],
    meshArrays: MeshArrays,
    valuePredicate?: (value: number) => boolean,
  ): void {
    meshArrays.reset();

    if (octree.size === 0) return;

    let maxX = 0, maxY = 0, maxZ = 0;
    for (const key of octree.keys()) {
      const x = key & 0x3ff;
      const y = (key >> 10) & 0x3ff;
      const z = (key >> 20) & 0x3ff;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const sX = maxX + 3;
    const sY = maxY + 3;
    const sZ = maxZ + 3;

    if (!this.occupancy || sX > this.occSizeX || sY > this.occSizeY || sZ > this.occSizeZ) {
      this.occSizeX = sX;
      this.occSizeY = sY;
      this.occSizeZ = sZ;
      this.occupancy = new Uint8Array(sX * sY * sZ);
    } else {
      this.occupancy.fill(0);
    }

    const occ = this.occupancy;
    const strideY = sZ;
    const strideX = sY * sZ;

    for (const [key, value] of octree.entries()) {
      const x = key & 0x3ff;
      const y = (key >> 10) & 0x3ff;
      const z = (key >> 20) & 0x3ff;
      const occIdx = (x + 1) * strideX + (y + 1) * strideY + (z + 1);

      if (valuePredicate) {
        occ[occIdx] = valuePredicate(value) ? 1 : 0;
      } else {
        occ[occIdx] = (value > 0 && value !== PREVIEW_ERASE_SENTINEL) ? 1 : 0;
      }
    }

    const neighborOffsets = [strideX, -strideX, strideY, -strideY, 1, -1];

    const vertices = meshArrays.vertices;
    const normalsArr = meshArrays.normals;
    const uvsArr = meshArrays.uvs;
    const aoArr = meshArrays.ao;
    const isSelectedArr = meshArrays.isSelected;
    const indicesArr = meshArrays.indices;
    let vertexCount = 0;
    let indexCount = 0;

    for (const [key, value] of octree.entries()) {
      if (valuePredicate && !valuePredicate(value)) continue;

      const x = key & 0x3ff;
      const y = (key >> 10) & 0x3ff;
      const z = (key >> 20) & 0x3ff;
      const occIdx = (x + 1) * strideX + (y + 1) * strideY + (z + 1);

      const blockType = value;

      for (let faceDir = 0; faceDir < 6; faceDir++) {
        if (occ[occIdx + neighborOffsets[faceDir]]) continue;

        const textureIndex = blockAtlasMappings[blockType - 1][faceDir];
        const textureCoords = getTextureCoordinates(textureIndex, textureWidth);
        const faceData = faces[faceDir];
        const normal = faceData.normal;
        const faceVertices = faceData.vertices;

        const n0 = normal[0];
        const n1 = normal[1];
        const n2 = normal[2];

        const baseX = x + 0.5;
        const baseY = y + 0.5;
        const baseZ = z + 0.5;

        const vOff3 = vertexCount * 3;
        const vOff2 = vertexCount * 2;

        for (let vi = 0; vi < 4; vi++) {
          const fv = faceVertices[vi];
          const off3 = vOff3 + vi * 3;
          vertices[off3] = baseX + fv[0];
          vertices[off3 + 1] = baseY + fv[1];
          vertices[off3 + 2] = baseZ + fv[2];

          normalsArr[off3] = n0;
          normalsArr[off3 + 1] = n1;
          normalsArr[off3 + 2] = n2;

          const off2 = vOff2 + vi * 2;
          uvsArr[off2] = textureCoords[vi * 2];
          uvsArr[off2 + 1] = textureCoords[vi * 2 + 1];

          aoArr[vertexCount + vi] = 1.0;
          isSelectedArr[vertexCount + vi] = 0;
        }

        indicesArr[indexCount] = vertexCount;
        indicesArr[indexCount + 1] = vertexCount + 1;
        indicesArr[indexCount + 2] = vertexCount + 2;
        indicesArr[indexCount + 3] = vertexCount;
        indicesArr[indexCount + 4] = vertexCount + 2;
        indicesArr[indexCount + 5] = vertexCount + 3;

        vertexCount += 4;
        indexCount += 6;
      }
    }

    meshArrays.vertexCount = vertexCount;
    meshArrays.indexCount = indexCount;
  }
}
