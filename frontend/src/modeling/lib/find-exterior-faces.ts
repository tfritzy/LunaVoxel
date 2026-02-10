import type { BlockModificationMode, Vector3 } from "@/state/types";
import { faces, INVISIBLE_VOXEL_MARKER } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import {
  calculateAmbientOcclusion,
  OCCLUSION_LEVELS,
} from "./ambient-occlusion";
import { VoxelFrame } from "./voxel-frame";
import { FlatVoxelFrame } from "./flat-voxel-frame";

export const DISABLE_GREEDY_MESHING = false;

function isNeighborInBounds(
  axis: number,
  dir: number,
  neighborCoord: number,
  maxCoord: number
): boolean {
  return dir > 0 ? neighborCoord < maxCoord : neighborCoord >= 0;
}

export class ExteriorFacesFinder {
  private realMask: Int16Array;
  private previewMask: Int16Array;
  private selectionMask: Int16Array;
  private processed: Uint8Array;
  private aoMask: Uint8Array;
  private isSelectedMask: Uint8Array;
  private maskSize: number;
  private maxDim: number;

  constructor(maxDimension: number) {
    this.maskSize = maxDimension ** 2;
    this.maxDim = maxDimension;
    this.realMask = new Int16Array(this.maskSize);
    this.previewMask = new Int16Array(this.maskSize);
    this.selectionMask = new Int16Array(this.maskSize);
    this.processed = new Uint8Array(this.maskSize);
    this.aoMask = new Uint8Array(this.maskSize);
    this.isSelectedMask = new Uint8Array(this.maskSize);
  }

  public findExteriorFaces(
    voxelData: Uint8Array,
    textureWidth: number,
    blockAtlasMappings: number[][],
    dimensions: Vector3,
    meshArrays: MeshArrays,
    previewMeshArrays: MeshArrays,
    previewFrame: VoxelFrame,
    selectionFrame: FlatVoxelFrame,
    previewOccludes: boolean,
    buildMode?: BlockModificationMode
  ): void {
    meshArrays.reset();
    previewMeshArrays.reset();

    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    const currentMaskSize = maxDimension ** 2;

    if (currentMaskSize > this.maskSize) {
      this.maskSize = currentMaskSize;
      this.maxDim = maxDimension;
      this.realMask = new Int16Array(currentMaskSize);
      this.previewMask = new Int16Array(currentMaskSize);
      this.selectionMask = new Int16Array(currentMaskSize);
      this.processed = new Uint8Array(currentMaskSize);
      this.aoMask = new Uint8Array(currentMaskSize);
      this.isSelectedMask = new Uint8Array(currentMaskSize);
    }

    const dimX = dimensions.x;
    const dimY = dimensions.y;
    const dimZ = dimensions.z;
    const strideX = dimY * dimZ;
    const previewData = previewFrame.data;
    const previewEmpty = previewFrame.isEmpty();
    const maxDim = this.maxDim;
    const isEraseMode = buildMode?.tag === "Erase";

    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;

      const axisSize = axis === 0 ? dimX : axis === 1 ? dimY : dimZ;
      const uSize = u === 0 ? dimX : u === 1 ? dimY : dimZ;
      const vSize = v === 0 ? dimX : v === 1 ? dimY : dimZ;

      for (let dir = -1; dir <= 1; dir += 2) {
        const faceDir = axis * 2 + (dir > 0 ? 0 : 1);

        for (let d = 0; d < axisSize; d++) {
          for (let iv = 0; iv < vSize; iv++) {
            const rowOffset = iv * maxDim;
            this.realMask.fill(-1, rowOffset, rowOffset + uSize);
            this.previewMask.fill(-1, rowOffset, rowOffset + uSize);
            this.selectionMask.fill(-1, rowOffset, rowOffset + uSize);
            this.aoMask.fill(0, rowOffset, rowOffset + uSize);
            this.isSelectedMask.fill(0, rowOffset, rowOffset + uSize);
          }

          let hasRealFaces = false;
          let hasPreviewFaces = false;

          for (let iu = 0; iu < uSize; iu++) {
            for (let iv = 0; iv < vSize; iv++) {
              const x = axis === 0 ? d : u === 0 ? iu : iv;
              const y = axis === 1 ? d : u === 1 ? iu : iv;
              const z = axis === 2 ? d : u === 2 ? iu : iv;

              const voxelIndex = x * strideX + y * dimZ + z;
              const blockValue = voxelData[voxelIndex];
              const blockPresent = blockValue !== 0;
              const blockVisible = blockValue !== 0 && blockValue !== INVISIBLE_VOXEL_MARKER;
              const previewBlockValue = previewEmpty ? 0 : previewData[x][y][z];
              const blockIsPreview = previewBlockValue !== 0;
              const selectionBlockValue = selectionFrame.get(x, y, z);
              const blockIsSelected = selectionBlockValue !== 0;

              if (!blockPresent && !blockIsPreview && !blockIsSelected) {
                continue;
              }

              let effectiveBlockValue = 0;
              if (blockIsPreview) {
                effectiveBlockValue = previewBlockValue;
              } else if (blockVisible) {
                effectiveBlockValue = blockValue;
              }
              const blockType = Math.max(effectiveBlockValue, 1);

              const nx = x + (axis === 0 ? dir : 0);
              const ny = y + (axis === 1 ? dir : 0);
              const nz = z + (axis === 2 ? dir : 0);

              const neighborInBounds =
                axis === 0
                  ? isNeighborInBounds(axis, dir, nx, dimX)
                  : axis === 1
                    ? isNeighborInBounds(axis, dir, ny, dimY)
                    : isNeighborInBounds(axis, dir, nz, dimZ);

              const neighborValue = neighborInBounds ? voxelData[nx * strideX + ny * dimZ + nz] : 0;
              const neighborVisible = neighborValue !== 0 && neighborValue !== INVISIBLE_VOXEL_MARKER;
              const neighborIsPreview = !previewEmpty && neighborInBounds && previewData[nx][ny][nz] !== 0;
              const neighborIsSolid = neighborValue !== 0;

              const maskIdx = iv * maxDim + iu;

              if (blockIsPreview) {
                const shouldRenderFace = !neighborIsPreview && (isEraseMode ? !neighborIsSolid : true);

                if (shouldRenderFace) {
                  const textureIndex =
                    blockAtlasMappings[blockType - 1][faceDir];

                  this.aoMask[maskIdx] = calculateAmbientOcclusion(
                    nx,
                    ny,
                    nz,
                    faceDir,
                    voxelData,
                    dimensions,
                    previewFrame,
                    previewOccludes
                  );

                  this.previewMask[maskIdx] = textureIndex;
                  hasPreviewFaces = true;
                }
              } else if (blockIsSelected) {
                const neighborIsSelected = neighborInBounds && selectionFrame.isSet(nx, ny, nz);
                const shouldRenderSelectionFace = !neighborIsSelected;

                if (shouldRenderSelectionFace) {
                  const textureIndex =
                    blockAtlasMappings[blockType - 1][faceDir];
                  
                  this.aoMask[maskIdx] = calculateAmbientOcclusion(
                    nx,
                    ny,
                    nz,
                    faceDir,
                    voxelData,
                    dimensions,
                    previewFrame,
                    previewOccludes
                  );
                  
                  this.realMask[maskIdx] = textureIndex;
                  this.isSelectedMask[maskIdx] = 1;
                  hasRealFaces = true;
                }
              } else if (blockVisible) {
                const shouldRenderFace =
                  !neighborVisible || neighborIsPreview;

                if (shouldRenderFace) {
                  const textureIndex =
                    blockAtlasMappings[blockType - 1][faceDir];

                  this.aoMask[maskIdx] = calculateAmbientOcclusion(
                    nx,
                    ny,
                    nz,
                    faceDir,
                    voxelData,
                    dimensions,
                    previewFrame,
                    previewOccludes
                  );

                  this.realMask[maskIdx] = textureIndex;
                  hasRealFaces = true;
                }
              }
            }
          }

          if (hasRealFaces) {
            this.generateGreedyMesh(
              this.realMask,
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
          if (hasPreviewFaces) {
            this.generateGreedyMesh(
              this.previewMask,
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
              previewMeshArrays
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

        const faceOffset = dir > 0 ? 1 : 0;

        const textureCoords = getTextureCoordinates(textureIndex, textureWidth);

        const faceData = faces[faceDir];
        const normal = faceData.normal;

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
