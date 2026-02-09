import { SparseVoxelOctree } from "./sparse-voxel-octree";
import { getTextureCoordinates } from "./texture-coords";
import { faces } from "./voxel-constants";
import { MeshArrays } from "./mesh-arrays";

const DIRECTION_OFFSETS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

export class OctreeMesher {
  buildMesh(
    octree: SparseVoxelOctree,
    textureWidth: number,
    blockAtlasMappings: number[][],
    meshArrays: MeshArrays,
    globalOccupancy: Uint8Array[][],
  ): void {
    meshArrays.reset();

    if (octree.size === 0) return;

    const dimX = globalOccupancy.length;
    const dimY = dimX > 0 ? globalOccupancy[0].length : 0;
    const dimZ = dimY > 0 ? globalOccupancy[0][0].length : 0;

    for (const [key, entry] of octree.entries()) {
      if (entry.blockType <= 0) continue;
      const x = key & 0x3ff;
      const y = (key >> 10) & 0x3ff;
      const z = (key >> 20) & 0x3ff;
      if (x < dimX && y < dimY && z < dimZ && globalOccupancy[x][y][z] === 0) {
        globalOccupancy[x][y][z] = 2;
      }
    }

    const vertices = meshArrays.vertices;
    const normalsArr = meshArrays.normals;
    const uvsArr = meshArrays.uvs;
    const aoArr = meshArrays.ao;
    const isSelectedArr = meshArrays.isSelected;
    const indicesArr = meshArrays.indices;
    let vertexCount = 0;
    let indexCount = 0;

    for (const [key, entry] of octree.entries()) {
      if (entry.blockType <= 0) continue;

      const x = key & 0x3ff;
      const y = (key >> 10) & 0x3ff;
      const z = (key >> 20) & 0x3ff;

      if (x >= dimX || y >= dimY || z >= dimZ) continue;
      if (globalOccupancy[x][y][z] !== 2) continue;

      for (let faceDir = 0; faceDir < 6; faceDir++) {
        const dir = DIRECTION_OFFSETS[faceDir];
        const nx = x + dir[0];
        const ny = y + dir[1];
        const nz = z + dir[2];

        if (nx >= 0 && nx < dimX && ny >= 0 && ny < dimY && nz >= 0 && nz < dimZ) {
          if (globalOccupancy[nx][ny][nz] > 0) continue;
        }

        const textureIndex = blockAtlasMappings[entry.blockType - 1][faceDir];
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

          aoArr[vertexCount + vi] = entry.invisible ? 0.0 : 1.0;
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
