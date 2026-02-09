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

    const vertices = meshArrays.vertices;
    const normalsArr = meshArrays.normals;
    const uvsArr = meshArrays.uvs;
    const aoArr = meshArrays.ao;
    const isSelectedArr = meshArrays.isSelected;
    const indicesArr = meshArrays.indices;
    let vertexCount = 0;
    let indexCount = 0;

    octree.forEachVoxel((x, y, z, value) => {
      if (value.blockType <= 0) return;
      if (x < dimX && y < dimY && z < dimZ && globalOccupancy[x][y][z] === 0) {
        globalOccupancy[x][y][z] = 2;
      }
    });

    const getOccupancyState = (ox: number, oy: number, oz: number, size: number): number => {
      let hasVisible = false;
      let hasHidden = false;
      const maxX = Math.min(ox + size, dimX);
      const maxY = Math.min(oy + size, dimY);
      const maxZ = Math.min(oz + size, dimZ);

      if (ox < 0 || oy < 0 || oz < 0 || ox + size > dimX || oy + size > dimY || oz + size > dimZ) {
        hasHidden = true;
      }

      for (let x = Math.max(0, ox); x < maxX; x++) {
        for (let y = Math.max(0, oy); y < maxY; y++) {
          for (let z = Math.max(0, oz); z < maxZ; z++) {
            if (globalOccupancy[x][y][z] === 2) {
              hasVisible = true;
            } else {
              hasHidden = true;
            }
            if (hasVisible && hasHidden) return 2;
          }
        }
      }

      if (!hasVisible) return 0;
      return hasHidden ? 2 : 1;
    };

    const emitFace = (
      ox: number,
      oy: number,
      oz: number,
      size: number,
      faceDir: number,
      value: { blockType: number; invisible: boolean },
    ) => {
      const aoVal = value.invisible ? 0.0 : 1.0;
      const mapping = blockAtlasMappings[value.blockType - 1];
      const half = size / 2;
      const baseX = ox + half;
      const baseY = oy + half;
      const baseZ = oz + half;
      const scale = size;

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
      vertices[vOff3] = baseX + FACE_VERTS[fvBase] * scale;
      vertices[vOff3 + 1] = baseY + FACE_VERTS[fvBase + 1] * scale;
      vertices[vOff3 + 2] = baseZ + FACE_VERTS[fvBase + 2] * scale;
      normalsArr[vOff3] = n0; normalsArr[vOff3 + 1] = n1; normalsArr[vOff3 + 2] = n2;
      uvsArr[vOff2] = u; uvsArr[vOff2 + 1] = v;
      aoArr[vertexCount] = aoVal;
      isSelectedArr[vertexCount] = 0;

      // v1
      vertices[vOff3 + 3] = baseX + FACE_VERTS[fvBase + 3] * scale;
      vertices[vOff3 + 4] = baseY + FACE_VERTS[fvBase + 4] * scale;
      vertices[vOff3 + 5] = baseZ + FACE_VERTS[fvBase + 5] * scale;
      normalsArr[vOff3 + 3] = n0; normalsArr[vOff3 + 4] = n1; normalsArr[vOff3 + 5] = n2;
      uvsArr[vOff2 + 2] = u; uvsArr[vOff2 + 3] = v;
      aoArr[vertexCount + 1] = aoVal;
      isSelectedArr[vertexCount + 1] = 0;

      // v2
      vertices[vOff3 + 6] = baseX + FACE_VERTS[fvBase + 6] * scale;
      vertices[vOff3 + 7] = baseY + FACE_VERTS[fvBase + 7] * scale;
      vertices[vOff3 + 8] = baseZ + FACE_VERTS[fvBase + 8] * scale;
      normalsArr[vOff3 + 6] = n0; normalsArr[vOff3 + 7] = n1; normalsArr[vOff3 + 8] = n2;
      uvsArr[vOff2 + 4] = u; uvsArr[vOff2 + 5] = v;
      aoArr[vertexCount + 2] = aoVal;
      isSelectedArr[vertexCount + 2] = 0;

      // v3
      vertices[vOff3 + 9] = baseX + FACE_VERTS[fvBase + 9] * scale;
      vertices[vOff3 + 10] = baseY + FACE_VERTS[fvBase + 10] * scale;
      vertices[vOff3 + 11] = baseZ + FACE_VERTS[fvBase + 11] * scale;
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
    };

    const emitFacePatch = (
      ox: number,
      oy: number,
      oz: number,
      size: number,
      faceDir: number,
      value: { blockType: number; invisible: boolean },
    ) => {
      const occupancyState = getOccupancyState(ox, oy, oz, size);
      if (occupancyState === 0) return;

      const dir = DIRECTION_OFFSETS[faceDir];
      const nx = ox + dir[0] * size;
      const ny = oy + dir[1] * size;
      const nz = oz + dir[2] * size;
      const neighborInBounds =
        nx >= 0 &&
        ny >= 0 &&
        nz >= 0 &&
        nx + size <= dimX &&
        ny + size <= dimY &&
        nz + size <= dimZ;
      const neighborValue = neighborInBounds ? octree.getRegionValue(nx, ny, nz, size) : null;
      if (neighborValue && neighborValue.blockType > 0) return;

      const needsSplit = (neighborValue === undefined || occupancyState === 2) && size > 1;
      if (needsSplit) {
        const half = size / 2;
        if (faceDir < 2) {
          for (let y = 0; y <= 1; y++) {
            for (let z = 0; z <= 1; z++) {
              emitFacePatch(ox, oy + y * half, oz + z * half, half, faceDir, value);
            }
          }
        } else if (faceDir < 4) {
          for (let x = 0; x <= 1; x++) {
            for (let z = 0; z <= 1; z++) {
              emitFacePatch(ox + x * half, oy, oz + z * half, half, faceDir, value);
            }
          }
        } else {
          for (let x = 0; x <= 1; x++) {
            for (let y = 0; y <= 1; y++) {
              emitFacePatch(ox + x * half, oy + y * half, oz, half, faceDir, value);
            }
          }
        }
        return;
      }

      emitFace(ox, oy, oz, size, faceDir, value);
    };

    octree.forEachLeaf((ox, oy, oz, size, value) => {
      if (value.blockType <= 0) return;
      for (let faceDir = 0; faceDir < 6; faceDir++) {
        emitFacePatch(ox, oy, oz, size, faceDir, value);
      }
    });

    meshArrays.vertexCount = vertexCount;
    meshArrays.indexCount = indexCount;
  }
}
