import { SparseVoxelOctree } from "./sparse-voxel-octree";
import { faces } from "./voxel-constants";
import { MeshArrays } from "./mesh-arrays";

const texCoordsCache: Map<number, Float64Array> = new Map();
function getTexCoordsCached(textureIndex: number, textureWidth: number): Float64Array {
  const cacheKey = textureIndex * 10000 + textureWidth;
  let coords = texCoordsCache.get(cacheKey);
  if (coords) return coords;
  const textureSize = 1.0 / textureWidth;
  const halfPixel = textureSize * 0.5;
  const u = (textureIndex % textureWidth) * textureSize + halfPixel;
  const v = 1.0 - (Math.floor(textureIndex / textureWidth) * textureSize + halfPixel);
  coords = new Float64Array([u, v, u, v, u, v, u, v]);
  texCoordsCache.set(cacheKey, coords);
  return coords;
}

const DIRECTION_OFFSETS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

const FACE_VERTS = new Float32Array(72);
const FACE_NORMALS = new Float32Array(18);
for (let f = 0; f < 6; f++) {
  const fd = faces[f];
  FACE_NORMALS[f * 3] = fd.normal[0];
  FACE_NORMALS[f * 3 + 1] = fd.normal[1];
  FACE_NORMALS[f * 3 + 2] = fd.normal[2];
  for (let v = 0; v < 4; v++) {
    FACE_VERTS[f * 12 + v * 3] = fd.vertices[v][0];
    FACE_VERTS[f * 12 + v * 3 + 1] = fd.vertices[v][1];
    FACE_VERTS[f * 12 + v * 3 + 2] = fd.vertices[v][2];
  }
}

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

    for (const entry of octree.values()) {
      if (entry.blockType <= 0) continue;
      const ex = entry.x, ey = entry.y, ez = entry.z;
      if (ex < dimX && ey < dimY && ez < dimZ && globalOccupancy[ex][ey][ez] === 0) {
        globalOccupancy[ex][ey][ez] = 2;
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

    for (const entry of octree.values()) {
      if (entry.blockType <= 0) continue;

      const x = entry.x, y = entry.y, z = entry.z;

      if (x >= dimX || y >= dimY || z >= dimZ) continue;
      if (globalOccupancy[x][y][z] !== 2) continue;

      const aoVal = entry.invisible ? 0.0 : 1.0;
      const mapping = blockAtlasMappings[entry.blockType - 1];
      const baseX = x + 0.5;
      const baseY = y + 0.5;
      const baseZ = z + 0.5;

      for (let faceDir = 0; faceDir < 6; faceDir++) {
        const dir = DIRECTION_OFFSETS[faceDir];
        const nx = x + dir[0];
        const ny = y + dir[1];
        const nz = z + dir[2];

        if (nx >= 0 && nx < dimX && ny >= 0 && ny < dimY && nz >= 0 && nz < dimZ) {
          if (globalOccupancy[nx][ny][nz] > 0) continue;
        }

        const textureCoords = getTexCoordsCached(mapping[faceDir], textureWidth);
        const fvBase = faceDir * 12;
        const fnBase = faceDir * 3;
        const n0 = FACE_NORMALS[fnBase];
        const n1 = FACE_NORMALS[fnBase + 1];
        const n2 = FACE_NORMALS[fnBase + 2];

        const vOff3 = vertexCount * 3;
        const vOff2 = vertexCount * 2;
        const u = textureCoords[0];
        const v = textureCoords[1];

        // v0
        vertices[vOff3] = baseX + FACE_VERTS[fvBase];
        vertices[vOff3 + 1] = baseY + FACE_VERTS[fvBase + 1];
        vertices[vOff3 + 2] = baseZ + FACE_VERTS[fvBase + 2];
        normalsArr[vOff3] = n0; normalsArr[vOff3 + 1] = n1; normalsArr[vOff3 + 2] = n2;
        uvsArr[vOff2] = u; uvsArr[vOff2 + 1] = v;
        aoArr[vertexCount] = aoVal;
        isSelectedArr[vertexCount] = 0;

        // v1
        vertices[vOff3 + 3] = baseX + FACE_VERTS[fvBase + 3];
        vertices[vOff3 + 4] = baseY + FACE_VERTS[fvBase + 4];
        vertices[vOff3 + 5] = baseZ + FACE_VERTS[fvBase + 5];
        normalsArr[vOff3 + 3] = n0; normalsArr[vOff3 + 4] = n1; normalsArr[vOff3 + 5] = n2;
        uvsArr[vOff2 + 2] = u; uvsArr[vOff2 + 3] = v;
        aoArr[vertexCount + 1] = aoVal;
        isSelectedArr[vertexCount + 1] = 0;

        // v2
        vertices[vOff3 + 6] = baseX + FACE_VERTS[fvBase + 6];
        vertices[vOff3 + 7] = baseY + FACE_VERTS[fvBase + 7];
        vertices[vOff3 + 8] = baseZ + FACE_VERTS[fvBase + 8];
        normalsArr[vOff3 + 6] = n0; normalsArr[vOff3 + 7] = n1; normalsArr[vOff3 + 8] = n2;
        uvsArr[vOff2 + 4] = u; uvsArr[vOff2 + 5] = v;
        aoArr[vertexCount + 2] = aoVal;
        isSelectedArr[vertexCount + 2] = 0;

        // v3
        vertices[vOff3 + 9] = baseX + FACE_VERTS[fvBase + 9];
        vertices[vOff3 + 10] = baseY + FACE_VERTS[fvBase + 10];
        vertices[vOff3 + 11] = baseZ + FACE_VERTS[fvBase + 11];
        normalsArr[vOff3 + 9] = n0; normalsArr[vOff3 + 10] = n1; normalsArr[vOff3 + 11] = n2;
        uvsArr[vOff2 + 6] = u; uvsArr[vOff2 + 7] = v;
        aoArr[vertexCount + 3] = aoVal;
        isSelectedArr[vertexCount + 3] = 0;

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
