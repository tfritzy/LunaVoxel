import type { Vector3 } from "@/state/types";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import {
  calculateAmbientOcclusion,
  OCCLUSION_LEVELS,
} from "./ambient-occlusion";
import { VoxelFrame } from "./voxel-frame";

export const DISABLE_GREEDY_MESHING = false;

const PACKED_PRESENT_BIT = 1 << 19;

const AO_CORNER_TABLE: number[][] = [];
for (let fd = 0; fd < 6; fd++) {
  const swapped = fd === 1 || fd === 2 || fd === 5;
  AO_CORNER_TABLE[fd] = swapped ? [0, 3, 2, 1] : [0, 1, 2, 3];
}

export class ExteriorFacesFinder {
  private packedMask: Int32Array;
  private processed: Uint8Array;
  private maskSize: number;
  private maxDim: number;
  private dirtyIndices: Int32Array;

  constructor(maxDimension: number) {
    this.maskSize = maxDimension ** 2;
    this.maxDim = maxDimension;
    this.packedMask = new Int32Array(this.maskSize);
    this.processed = new Uint8Array(this.maskSize);
    this.dirtyIndices = new Int32Array(this.maskSize);
  }

  public findExteriorFaces(
    voxelData: Uint8Array,
    textureWidth: number,
    blockAtlasMapping: number[],
    dimensions: Vector3,
    meshArrays: MeshArrays,
    selectionFrame: VoxelFrame
  ): void {
    meshArrays.reset();

    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    const currentMaskSize = maxDimension ** 2;

    if (currentMaskSize > this.maskSize) {
      this.maskSize = currentMaskSize;
      this.maxDim = maxDimension;
      this.packedMask = new Int32Array(currentMaskSize);
      this.processed = new Uint8Array(currentMaskSize);
      this.dirtyIndices = new Int32Array(currentMaskSize);
    }

    const dimX = dimensions.x;
    const dimY = dimensions.y;
    const dimZ = dimensions.z;
    const strideX = dimY * dimZ;
    const maxDim = this.maxDim;
    const selectionEmpty = selectionFrame.isEmpty();
    const dims = [dimX, dimY, dimZ];

    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;

      const axisSize = dims[axis];
      const uSize = dims[u];
      const vSize = dims[v];

      for (let dir = -1; dir <= 1; dir += 2) {
        const faceDir = axis * 2 + (dir > 0 ? 0 : 1);
        const dx = axis === 0 ? dir : 0;
        const dy = axis === 1 ? dir : 0;
        const dz = axis === 2 ? dir : 0;
        const neighborMax = dims[axis];

        const xIsDepth = axis === 0;
        const yIsDepth = axis === 1;
        const zIsDepth = axis === 2;
        const xIsUAxis = !xIsDepth && u === 0;
        const yIsUAxis = !yIsDepth && u === 1;
        const zIsUAxis = !zIsDepth && u === 2;

        for (let d = 0; d < axisSize; d++) {
          let hasFaces = false;
          let dirtyCount = 0;

          for (let iu = 0; iu < uSize; iu++) {
            for (let iv = 0; iv < vSize; iv++) {
              const x = xIsDepth ? d : xIsUAxis ? iu : iv;
              const y = yIsDepth ? d : yIsUAxis ? iu : iv;
              const z = zIsDepth ? d : zIsUAxis ? iu : iv;

              const blockValue = voxelData[x * strideX + y * dimZ + z];
              const blockType = blockValue & 0x7F;
              const blockVisible = blockType !== 0;
              const blockIsSelected = !selectionEmpty && selectionFrame.isSet(x, y, z);

              if (!blockVisible && !blockIsSelected) {
                continue;
              }

              const nx = x + dx;
              const ny = y + dy;
              const nz = z + dz;

              const maskIdx = iv * maxDim + iu;

              if (blockIsSelected && !blockVisible) {
                const neighborCoord = xIsDepth ? nx : yIsDepth ? ny : nz;
                const neighborInBounds = dir > 0 ? neighborCoord < neighborMax : neighborCoord >= 0;
                const neighborIsSelected = neighborInBounds && selectionFrame.isSet(nx, ny, nz);

                if (!neighborIsSelected) {
                  const selectionBlockType = selectionFrame.get(x, y, z) & 0x7F;
                  const textureIndex =
                    blockAtlasMapping[Math.max(selectionBlockType, 1) - 1];

                  const ao = calculateAmbientOcclusion(
                    nx, ny, nz, faceDir, voxelData, dimX, dimY, dimZ, strideX
                  );

                  this.packedMask[maskIdx] = PACKED_PRESENT_BIT | (textureIndex & 0x3FF) | ((ao & 0xFF) << 10) | (1 << 18);
                  this.dirtyIndices[dirtyCount++] = maskIdx;
                  hasFaces = true;
                }
              } else if (blockVisible) {
                const neighborCoord = xIsDepth ? nx : yIsDepth ? ny : nz;
                const neighborInBounds = dir > 0 ? neighborCoord < neighborMax : neighborCoord >= 0;
                const neighborVisible = neighborInBounds && (voxelData[nx * strideX + ny * dimZ + nz] & 0x7F) !== 0;

                if (!neighborVisible) {
                  const textureIndex = blockAtlasMapping[blockType - 1];

                  const ao = calculateAmbientOcclusion(
                    nx, ny, nz, faceDir, voxelData, dimX, dimY, dimZ, strideX
                  );

                  const sel = blockIsSelected ? 1 : 0;
                  this.packedMask[maskIdx] = PACKED_PRESENT_BIT | (textureIndex & 0x3FF) | ((ao & 0xFF) << 10) | (sel << 18);
                  this.dirtyIndices[dirtyCount++] = maskIdx;
                  hasFaces = true;
                }
              }
            }
          }

          if (hasFaces) {
            this.generateGreedyMesh(
              this.packedMask,
              this.processed,
              uSize,
              vSize,
              d,
              axis,
              u,
              v,
              dir,
              faceDir,
              textureWidth,
              meshArrays
            );
          }

          for (let di = 0; di < dirtyCount; di++) {
            this.packedMask[this.dirtyIndices[di]] = 0;
          }
        }
      }
    }
  }

  private generateGreedyMesh(
    packedMask: Int32Array,
    processed: Uint8Array,
    width: number,
    height: number,
    depth: number,
    axis: number,
    u: number,
    v: number,
    dir: number,
    faceDir: number,
    textureWidth: number,
    meshArrays: MeshArrays
  ): void {
    const stride = this.maxDim;
    const faceData = faces[faceDir];
    const normal = faceData.normal;
    const faceOffset = dir > 0 ? 1 : 0;
    const aoCorners = AO_CORNER_TABLE[faceDir];

    const viSwap = dir < 0 ? [0, 3, 2, 1] : [0, 1, 2, 3];

    const vertUMult = new Float64Array(4);
    const vertVMult = new Float64Array(4);
    for (let vi = 0; vi < 4; vi++) {
      const actualVi = viSwap[vi];
      if (actualVi === 1) {
        vertUMult[vi] = 1;
        vertVMult[vi] = 0;
      } else if (actualVi === 2) {
        vertUMult[vi] = 1;
        vertVMult[vi] = 1;
      } else if (actualVi === 3) {
        vertUMult[vi] = 0;
        vertVMult[vi] = 1;
      }
    }

    for (let iv = 0; iv < height; iv++) {
      const rowOffset = iv * stride;
      processed.fill(0, rowOffset, rowOffset + width);
    }

    for (let j = 0; j < height; j++) {
      const jOffset = j * stride;
      for (let i = 0; i < width; ) {
        const ji = jOffset + i;
        if (processed[ji] || (packedMask[ji] & PACKED_PRESENT_BIT) === 0) {
          i++;
          continue;
        }

        const packed = packedMask[ji];
        const textureIndex = packed & 0x3FF;
        const aoVal = (packed >> 10) & 0xFF;
        const isSelected = (packed >> 18) & 0x1;
        let quadWidth = 1;
        if (!DISABLE_GREEDY_MESHING) {
          while (i + quadWidth < width) {
            const idx = jOffset + i + quadWidth;
            if (
              processed[idx] ||
              packedMask[idx] !== packed
            )
              break;
            quadWidth++;
          }
        }

        let quadHeight = 1;
        if (!DISABLE_GREEDY_MESHING) {
          outer: while (j + quadHeight < height) {
            const rowOff = (j + quadHeight) * stride;
            for (let w = 0; w < quadWidth; w++) {
              const idx = rowOff + i + w;
              if (
                processed[idx] ||
                packedMask[idx] !== packed
              )
                break outer;
            }
            quadHeight++;
          }
        }

        const endI = i + quadWidth;
        const endJ = j + quadHeight;
        for (let jj = j; jj < endJ; jj++) {
          const rowOff = jj * stride;
          for (let ii = i; ii < endI; ii++) {
            processed[rowOff + ii] = 1;
          }
        }

        const x = axis === 0 ? depth : u === 0 ? i : v === 0 ? j : 0;
        const y = axis === 1 ? depth : u === 1 ? i : v === 1 ? j : 0;
        const z = axis === 2 ? depth : u === 2 ? i : v === 2 ? j : 0;

        const textureCoords = getTextureCoordinates(textureIndex, textureWidth);

        const startVertexIndex = meshArrays.vertexCount;

        for (let vi = 0; vi < 4; vi++) {
          const uM = vertUMult[vi];
          const vM = vertVMult[vi];

          let vx: number, vy: number, vz: number;

          if (axis === 0) {
            vx = x + faceOffset;
            vy = y + (u === 1 ? quadWidth * uM : quadHeight * vM);
            vz = z + (u === 2 ? quadWidth * uM : quadHeight * vM);
          } else if (axis === 1) {
            vx = x + (u === 0 ? quadWidth * uM : quadHeight * vM);
            vy = y + faceOffset;
            vz = z + (u === 2 ? quadWidth * uM : quadHeight * vM);
          } else {
            vx = x + (u === 0 ? quadWidth * uM : quadHeight * vM);
            vy = y + (u === 1 ? quadWidth * uM : quadHeight * vM);
            vz = z + faceOffset;
          }

          meshArrays.pushVertex(vx, vy, vz);
          meshArrays.pushNormal(normal[0], normal[1], normal[2]);
          meshArrays.pushUV(textureCoords[vi * 2], textureCoords[vi * 2 + 1]);

          const aoCornerIndex = aoCorners[vi];
          const occlusionCount = (aoVal >> (aoCornerIndex * 2)) & 0x03;
          const aoFactor = OCCLUSION_LEVELS[occlusionCount];
          meshArrays.pushAO(aoFactor);
          meshArrays.pushIsSelected(isSelected);
          meshArrays.incrementVertex();
        }

        meshArrays.pushIndex(startVertexIndex);
        meshArrays.pushIndex(startVertexIndex + 1);
        meshArrays.pushIndex(startVertexIndex + 2);
        meshArrays.pushIndex(startVertexIndex);
        meshArrays.pushIndex(startVertexIndex + 2);
        meshArrays.pushIndex(startVertexIndex + 3);

        i += quadWidth;
      }
    }
  }
}
