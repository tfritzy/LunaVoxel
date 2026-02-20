import type { Vector3 } from "@/state/types";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import {
  calculateAmbientOcclusion,
  precomputeAoOffsets,
  OCCLUSION_LEVELS,
} from "./ambient-occlusion";

export const DISABLE_GREEDY_MESHING = false;



export class ExteriorFacesFinder {
  private mask: Int16Array;
  private processed: Uint8Array;
  private aoMask: Uint8Array;
  private isSelectedMask: Uint8Array;
  private maskSize: number;
  private maxDim: number;

  constructor(maxDimension: number) {
    this.maskSize = maxDimension ** 2;
    this.maxDim = maxDimension;
    this.mask = new Int16Array(this.maskSize);
    this.processed = new Uint8Array(this.maskSize);
    this.aoMask = new Uint8Array(this.maskSize);
    this.isSelectedMask = new Uint8Array(this.maskSize);
  }

  public findExteriorFaces(
    voxelData: Uint8Array,
    textureWidth: number,
    blockAtlasMapping: number[],
    dimensions: Vector3,
    meshArrays: MeshArrays,
    selectionBuffer: Uint8Array,
    selectionWorldDims: Vector3,
    chunkOffset: Vector3,
    selectionEmpty: boolean
  ): void {
    meshArrays.reset();

    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    const currentMaskSize = maxDimension ** 2;

    if (currentMaskSize > this.maskSize) {
      this.maskSize = currentMaskSize;
      this.maxDim = maxDimension;
      this.mask = new Int16Array(currentMaskSize);
      this.processed = new Uint8Array(currentMaskSize);
      this.aoMask = new Uint8Array(currentMaskSize);
      this.isSelectedMask = new Uint8Array(currentMaskSize);
    }

    const dimX = dimensions.x;
    const dimY = dimensions.y;
    const dimZ = dimensions.z;
    const strideX = dimY * dimZ;
    const maxDim = this.maxDim;
    const selWorldYZ = selectionWorldDims.y * selectionWorldDims.z;
    const selWorldZ = selectionWorldDims.z;
    const offX = chunkOffset.x;
    const offY = chunkOffset.y;
    const offZ = chunkOffset.z;

    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;

      const axisSize = axis === 0 ? dimX : axis === 1 ? dimY : dimZ;
      const uSize = u === 0 ? dimX : u === 1 ? dimY : dimZ;
      const vSize = v === 0 ? dimX : v === 1 ? dimY : dimZ;

      for (let dir = -1; dir <= 1; dir += 2) {
        const faceDir = axis * 2 + (dir > 0 ? 0 : 1);
        const dx = axis === 0 ? dir : 0;
        const dy = axis === 1 ? dir : 0;
        const dz = axis === 2 ? dir : 0;
        const neighborMax = axis === 0 ? dimX : axis === 1 ? dimY : dimZ;
        const aoOffsets = precomputeAoOffsets(faceDir, strideX, dimZ);
        const normalFlatOffset = dx * strideX + dy * dimZ + dz;
        
        const xIsDepth = axis === 0;
        const yIsDepth = axis === 1;
        const zIsDepth = axis === 2;
        const xIsUAxis = !xIsDepth && u === 0;
        const yIsUAxis = !yIsDepth && u === 1;
        const zIsUAxis = !zIsDepth && u === 2;

        for (let d = 0; d < axisSize; d++) {
          for (let iv = 0; iv < vSize; iv++) {
            const rowOffset = iv * maxDim;
            this.mask.fill(-1, rowOffset, rowOffset + uSize);
            this.aoMask.fill(0, rowOffset, rowOffset + uSize);
            this.isSelectedMask.fill(0, rowOffset, rowOffset + uSize);
          }

          let hasFaces = false;

          for (let iu = 0; iu < uSize; iu++) {
            for (let iv = 0; iv < vSize; iv++) {
              const x = xIsDepth ? d : xIsUAxis ? iu : iv;
              const y = yIsDepth ? d : yIsUAxis ? iu : iv;
              const z = zIsDepth ? d : zIsUAxis ? iu : iv;

              const blockIdx = x * strideX + y * dimZ + z;
              const blockValue = voxelData[blockIdx];
              const blockType = blockValue & 0x7F;
              const blockVisible = blockType !== 0;
              const blockIsSelected = selectionEmpty ? false : selectionBuffer[(offX + x) * selWorldYZ + (offY + y) * selWorldZ + (offZ + z)] !== 0;

              if (!blockVisible && !blockIsSelected) {
                continue;
              }

              const nx = x + dx;
              const ny = y + dy;
              const nz = z + dz;
              const neighborIdx = blockIdx + normalFlatOffset;

              const maskIdx = iv * maxDim + iu;

              if (blockIsSelected && !blockVisible) {
                const neighborCoord = xIsDepth ? nx : yIsDepth ? ny : nz;
                const neighborInBounds = dir > 0 ? neighborCoord < neighborMax : neighborCoord >= 0;
                const neighborIsSelected = neighborInBounds && selectionBuffer[(offX + nx) * selWorldYZ + (offY + ny) * selWorldZ + (offZ + nz)] !== 0;

                if (!neighborIsSelected) {
                  const selectionBlockType = selectionBuffer[(offX + x) * selWorldYZ + (offY + y) * selWorldZ + (offZ + z)] & 0x7F;
                  const textureIndex =
                    blockAtlasMapping[Math.max(selectionBlockType, 1) - 1];
                  
                  this.aoMask[maskIdx] = calculateAmbientOcclusion(
                    nx, ny, nz, voxelData, dimX, dimY, dimZ, neighborIdx, aoOffsets
                  );
                  
                  this.mask[maskIdx] = textureIndex;
                  this.isSelectedMask[maskIdx] = 1;
                  hasFaces = true;
                }
              } else if (blockVisible) {
                const neighborCoord = xIsDepth ? nx : yIsDepth ? ny : nz;
                const neighborInBounds = dir > 0 ? neighborCoord < neighborMax : neighborCoord >= 0;
                const neighborVisible = neighborInBounds && (voxelData[neighborIdx] & 0x7F) !== 0;

                if (!neighborVisible) {
                  const textureIndex = blockAtlasMapping[blockType - 1];

                  this.aoMask[maskIdx] = calculateAmbientOcclusion(
                    nx, ny, nz, voxelData, dimX, dimY, dimZ, neighborIdx, aoOffsets
                  );

                  this.mask[maskIdx] = textureIndex;
                  if (blockIsSelected) {
                    this.isSelectedMask[maskIdx] = 1;
                  }
                  hasFaces = true;
                }
              }
            }
          }

          if (hasFaces) {
            this.generateGreedyMesh(
              this.mask,
              this.aoMask,
              this.isSelectedMask,
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
        }
      }
    }
  }

  private generateGreedyMesh(
    mask: Int16Array,
    aoMask: Uint8Array,
    isSelectedMask: Uint8Array,
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
    
    for (let iv = 0; iv < height; iv++) {
      const rowOffset = iv * stride;
      processed.fill(0, rowOffset, rowOffset + width);
    }

    for (let j = 0; j < height; j++) {
      const jOffset = j * stride;
      for (let i = 0; i < width; ) {
        const ji = jOffset + i;
        if (processed[ji] || mask[ji] < 0) {
          i++;
          continue;
        }

        const textureIndex = mask[ji];
        const isSelected = isSelectedMask[ji];
        const aoVal = aoMask[ji];
        let quadWidth = 1;
        if (!DISABLE_GREEDY_MESHING) {
          while (i + quadWidth < width) {
            const idx = jOffset + i + quadWidth;
            if (
              processed[idx] ||
              mask[idx] !== textureIndex ||
              aoMask[idx] !== aoVal ||
              isSelectedMask[idx] !== isSelected
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
                mask[idx] !== textureIndex ||
                aoMask[idx] !== aoVal ||
                isSelectedMask[idx] !== isSelected
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
          let actualVi = vi;
          if (dir < 0 && (vi === 1 || vi === 3)) {
            actualVi = vi === 1 ? 3 : 1;
          }

          let vx: number, vy: number, vz: number;

          if (axis === 0) {
            vx = x + faceOffset;
            if (actualVi === 0) {
              vy = y;
              vz = z;
            } else if (actualVi === 1) {
              vy = y + (u === 1 ? quadWidth : 0);
              vz = z + (u === 2 ? quadWidth : 0);
            } else if (actualVi === 2) {
              vy = y + (u === 1 ? quadWidth : v === 1 ? quadHeight : 0);
              vz = z + (u === 2 ? quadWidth : v === 2 ? quadHeight : 0);
            } else {
              vy = y + (v === 1 ? quadHeight : 0);
              vz = z + (v === 2 ? quadHeight : 0);
            }
          } else if (axis === 1) {
            vy = y + faceOffset;
            if (actualVi === 0) {
              vx = x;
              vz = z;
            } else if (actualVi === 1) {
              vx = x + (u === 0 ? quadWidth : 0);
              vz = z + (u === 2 ? quadWidth : 0);
            } else if (actualVi === 2) {
              vx = x + (u === 0 ? quadWidth : v === 0 ? quadHeight : 0);
              vz = z + (u === 2 ? quadWidth : v === 2 ? quadHeight : 0);
            } else {
              vx = x + (v === 0 ? quadHeight : 0);
              vz = z + (v === 2 ? quadHeight : 0);
            }
          } else {
            vz = z + faceOffset;
            if (actualVi === 0) {
              vx = x;
              vy = y;
            } else if (actualVi === 1) {
              vx = x + (u === 0 ? quadWidth : 0);
              vy = y + (u === 1 ? quadWidth : 0);
            } else if (actualVi === 2) {
              vx = x + (u === 0 ? quadWidth : v === 0 ? quadHeight : 0);
              vy = y + (u === 1 ? quadWidth : v === 1 ? quadHeight : 0);
            } else {
              vx = x + (v === 0 ? quadHeight : 0);
              vy = y + (v === 1 ? quadHeight : 0);
            }
          }

          meshArrays.pushVertex(vx, vy, vz);
          meshArrays.pushNormal(normal[0], normal[1], normal[2]);
          meshArrays.pushUV(textureCoords[vi * 2], textureCoords[vi * 2 + 1]);

          const packedAO = aoVal;

          let aoCornerIndex: number;
          if (faceDir === 1 || faceDir === 2 || faceDir === 5) {
            aoCornerIndex = vi === 1 ? 3 : vi === 3 ? 1 : vi;
          } else {
            aoCornerIndex = vi;
          }

          const occlusionCount = (packedAO >> (aoCornerIndex * 2)) & 0x03;
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
