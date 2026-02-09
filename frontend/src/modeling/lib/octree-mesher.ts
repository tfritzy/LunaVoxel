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

const axisToIdx = (axis: 'x' | 'y' | 'z') => axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

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

interface VoxelFace {
  x: number;
  y: number;
  z: number;
  blockType: number;
  textureIndex: number;
  aoVal: number;
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

    // Collect visible faces by direction for greedy meshing
    const facesByDirection: VoxelFace[][] = [[], [], [], [], [], []];

    for (const entry of octree.values()) {
      if (entry.blockType <= 0) continue;

      const x = entry.x, y = entry.y, z = entry.z;

      if (x >= dimX || y >= dimY || z >= dimZ) continue;
      if (globalOccupancy[x][y][z] !== 2) continue;

      const aoVal = entry.invisible ? 0.0 : 1.0;
      const mapping = blockAtlasMappings[entry.blockType - 1];

      for (let faceDir = 0; faceDir < 6; faceDir++) {
        const dir = DIRECTION_OFFSETS[faceDir];
        const nx = x + dir[0];
        const ny = y + dir[1];
        const nz = z + dir[2];

        if (nx >= 0 && nx < dimX && ny >= 0 && ny < dimY && nz >= 0 && nz < dimZ) {
          if (globalOccupancy[nx][ny][nz] > 0) continue;
        }

        facesByDirection[faceDir].push({
          x, y, z,
          blockType: entry.blockType,
          textureIndex: mapping[faceDir],
          aoVal
        });
      }
    }

    // Greedy mesh each direction
    for (let faceDir = 0; faceDir < 6; faceDir++) {
      const faces = facesByDirection[faceDir];
      if (faces.length === 0) continue;

      const fnBase = faceDir * 3;
      const n0 = FACE_NORMALS[fnBase];
      const n1 = FACE_NORMALS[fnBase + 1];
      const n2 = FACE_NORMALS[fnBase + 2];

      // Determine the axes for this face direction
      let u_axis: 'x' | 'y' | 'z', v_axis: 'x' | 'y' | 'z', w_axis: 'x' | 'y' | 'z';
      if (faceDir < 2) { // +X or -X
        u_axis = 'y'; v_axis = 'z'; w_axis = 'x';
      } else if (faceDir < 4) { // +Y or -Y
        u_axis = 'x'; v_axis = 'z'; w_axis = 'y';
      } else { // +Z or -Z
        u_axis = 'x'; v_axis = 'y'; w_axis = 'z';
      }

      // Build a map for quick lookup
      const faceMap = new Map<string, VoxelFace>();
      let minU = Infinity, maxU = -Infinity;
      let minV = Infinity, maxV = -Infinity;
      let minW = Infinity, maxW = -Infinity;

      for (const face of faces) {
        const u = face[u_axis];
        const v = face[v_axis];
        const w = face[w_axis];
        const key = `${u},${v},${w}`;
        faceMap.set(key, face);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
        minW = Math.min(minW, w);
        maxW = Math.max(maxW, w);
      }

      // Greedy meshing: for each W plane
      const maskWidth = maxU - minU + 1;
      const maskHeight = maxV - minV + 1;
      const mask = new Array(maskWidth * maskHeight);
      
      for (let w = minW; w <= maxW; w++) {
        mask.fill(null);
        
        // Fill mask for this plane
        for (let u = minU; u <= maxU; u++) {
          for (let v = minV; v <= maxV; v++) {
            const key = `${u},${v},${w}`;
            const face = faceMap.get(key);
            if (face) {
              const maskIdx = (u - minU) + (v - minV) * maskWidth;
              mask[maskIdx] = face;
            }
          }
        }

        // Generate quads from mask
        for (let u = minU; u <= maxU; u++) {
          for (let v = minV; v <= maxV; v++) {
            const maskIdx = (u - minU) + (v - minV) * maskWidth;
            const face = mask[maskIdx];
            if (!face) continue;

            // Compute width (along u axis)
            let width = 1;
            for (let uu = u + 1; uu <= maxU; uu++) {
              const nextIdx = (uu - minU) + (v - minV) * maskWidth;
              const nextFace = mask[nextIdx];
              if (!nextFace || 
                  nextFace.blockType !== face.blockType ||
                  nextFace.textureIndex !== face.textureIndex ||
                  nextFace.aoVal !== face.aoVal) {
                break;
              }
              width++;
            }

            // Compute height (along v axis)
            let height = 1;
            let done = false;
            for (let vv = v + 1; vv <= maxV && !done; vv++) {
              for (let uu = u; uu < u + width; uu++) {
                const nextIdx = (uu - minU) + (vv - minV) * maskWidth;
                const nextFace = mask[nextIdx];
                if (!nextFace || 
                    nextFace.blockType !== face.blockType ||
                    nextFace.textureIndex !== face.textureIndex ||
                    nextFace.aoVal !== face.aoVal) {
                  done = true;
                  break;
                }
              }
              if (!done) height++;
            }

            // Clear the processed faces from mask
            for (let vv = v; vv < v + height; vv++) {
              for (let uu = u; uu < u + width; uu++) {
                const idx = (uu - minU) + (vv - minV) * maskWidth;
                mask[idx] = null;
              }
            }

            // Add merged quad
            const x = face.x;
            const y = face.y;
            const z = face.z;
            
            const textureCoords = getTexCoordsCached(face.textureIndex, textureWidth);
            const texU = textureCoords[0];
            const texV = textureCoords[1];

            // Generate vertices for the merged quad
            const vOff3 = vertexCount * 3;
            const vOff2 = vertexCount * 2;

            const fvBase = faceDir * 12;
            const baseX = x + 0.5;
            const baseY = y + 0.5;
            const baseZ = z + 0.5;

            // Scale vertices to match quad size
            const v0 = [FACE_VERTS[fvBase], FACE_VERTS[fvBase + 1], FACE_VERTS[fvBase + 2]];
            const v1 = [FACE_VERTS[fvBase + 3], FACE_VERTS[fvBase + 4], FACE_VERTS[fvBase + 5]];
            const v2 = [FACE_VERTS[fvBase + 6], FACE_VERTS[fvBase + 7], FACE_VERTS[fvBase + 8]];
            const v3 = [FACE_VERTS[fvBase + 9], FACE_VERTS[fvBase + 10], FACE_VERTS[fvBase + 11]];

            // Apply width and height scaling based on face direction
            const axisToIdx = (axis: 'x' | 'y' | 'z') => axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
            const u_idx = axisToIdx(u_axis);
            const v_idx = axisToIdx(v_axis);
            
            v1[u_idx] += width - 1;
            v2[u_idx] += width - 1;
            v2[v_idx] += height - 1;
            v3[v_idx] += height - 1;

            // v0
            vertices[vOff3] = baseX + v0[0];
            vertices[vOff3 + 1] = baseY + v0[1];
            vertices[vOff3 + 2] = baseZ + v0[2];
            normalsArr[vOff3] = n0;
            normalsArr[vOff3 + 1] = n1;
            normalsArr[vOff3 + 2] = n2;
            uvsArr[vOff2] = texU;
            uvsArr[vOff2 + 1] = texV;
            aoArr[vertexCount] = face.aoVal;
            isSelectedArr[vertexCount] = 0;

            // v1
            vertices[vOff3 + 3] = baseX + v1[0];
            vertices[vOff3 + 4] = baseY + v1[1];
            vertices[vOff3 + 5] = baseZ + v1[2];
            normalsArr[vOff3 + 3] = n0;
            normalsArr[vOff3 + 4] = n1;
            normalsArr[vOff3 + 5] = n2;
            uvsArr[vOff2 + 2] = texU;
            uvsArr[vOff2 + 3] = texV;
            aoArr[vertexCount + 1] = face.aoVal;
            isSelectedArr[vertexCount + 1] = 0;

            // v2
            vertices[vOff3 + 6] = baseX + v2[0];
            vertices[vOff3 + 7] = baseY + v2[1];
            vertices[vOff3 + 8] = baseZ + v2[2];
            normalsArr[vOff3 + 6] = n0;
            normalsArr[vOff3 + 7] = n1;
            normalsArr[vOff3 + 8] = n2;
            uvsArr[vOff2 + 4] = texU;
            uvsArr[vOff2 + 5] = texV;
            aoArr[vertexCount + 2] = face.aoVal;
            isSelectedArr[vertexCount + 2] = 0;

            // v3
            vertices[vOff3 + 9] = baseX + v3[0];
            vertices[vOff3 + 10] = baseY + v3[1];
            vertices[vOff3 + 11] = baseZ + v3[2];
            normalsArr[vOff3 + 9] = n0;
            normalsArr[vOff3 + 10] = n1;
            normalsArr[vOff3 + 11] = n2;
            uvsArr[vOff2 + 6] = texU;
            uvsArr[vOff2 + 7] = texV;
            aoArr[vertexCount + 3] = face.aoVal;
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
      }
    }

    meshArrays.vertexCount = vertexCount;
    meshArrays.indexCount = indexCount;
  }
}
