import { Vector3 } from "@/module_bindings";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";
import {
  calculateAmbientOcclusion,
  OCCLUSION_LEVELS,
} from "./ambient-occlusion";
import { getBlockType, isBlockPresent } from "./voxel-data-utils";
import { VoxelFrame } from "./voxel-frame";

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
  private realMask: Int16Array[];
  private previewMask: Int16Array[];
  private selectionMask: Int16Array[];
  private processed: Uint8Array[];
  private aoMask: Uint8Array[];
  private isSelectedMask: Uint8Array[];
  private maskSize: number;

  constructor(maxDimension: number) {
    this.maskSize = maxDimension ** 2;
    this.realMask = new Array(maxDimension);
    this.previewMask = new Array(maxDimension);
    this.selectionMask = new Array(maxDimension);
    this.processed = new Array(maxDimension);
    this.aoMask = new Array(maxDimension);
    this.isSelectedMask = new Array(maxDimension);
    for (let i = 0; i < maxDimension; i++) {
      this.realMask[i] = new Int16Array(maxDimension);
      this.previewMask[i] = new Int16Array(maxDimension);
      this.selectionMask[i] = new Int16Array(maxDimension);
      this.processed[i] = new Uint8Array(maxDimension);
      this.aoMask[i] = new Uint8Array(maxDimension);
      this.isSelectedMask[i] = new Uint8Array(maxDimension);
    }
  }

  public findExteriorFaces(
    voxelData: Uint8Array[][],
    textureWidth: number,
    blockAtlasMappings: number[][],
    dimensions: Vector3,
    meshArrays: MeshArrays,
    previewMeshArrays: MeshArrays,
    previewFrame: VoxelFrame,
    selectionFrame: VoxelFrame,
    previewOccludes: boolean
  ): void {
    meshArrays.reset();
    previewMeshArrays.reset();

    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    const currentMaskSize = maxDimension ** 2;

    if (currentMaskSize > this.maskSize) {
      this.maskSize = currentMaskSize;
      this.realMask = new Array(maxDimension);
      this.previewMask = new Array(maxDimension);
      this.selectionMask = new Array(maxDimension);
      this.processed = new Array(maxDimension);
      this.aoMask = new Array(maxDimension);
      this.isSelectedMask = new Array(maxDimension);
      for (let i = 0; i < maxDimension; i++) {
        this.realMask[i] = new Int16Array(maxDimension);
        this.previewMask[i] = new Int16Array(maxDimension);
        this.selectionMask[i] = new Int16Array(maxDimension);
        this.processed[i] = new Uint8Array(maxDimension);
        this.aoMask[i] = new Uint8Array(maxDimension);
        this.isSelectedMask[i] = new Uint8Array(maxDimension);
      }
    }

    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;

      const axisSize =
        axis === 0 ? dimensions.x : axis === 1 ? dimensions.y : dimensions.z;
      const uSize =
        u === 0 ? dimensions.x : u === 1 ? dimensions.y : dimensions.z;
      const vSize =
        v === 0 ? dimensions.x : v === 1 ? dimensions.y : dimensions.z;

      for (let dir = -1; dir <= 1; dir += 2) {
        const faceDir = axis * 2 + (dir > 0 ? 0 : 1);

        for (let d = 0; d < axisSize; d++) {
          for (let iv = 0; iv < vSize; iv++) {
            this.realMask[iv].fill(-1, 0, uSize);
            this.previewMask[iv].fill(-1, 0, uSize);
            this.selectionMask[iv].fill(-1, 0, uSize);
            this.aoMask[iv].fill(0, 0, uSize);
            this.isSelectedMask[iv].fill(0, 0, uSize);
          }

          let hasRealFaces = false;
          let hasPreviewFaces = false;

          for (let iu = 0; iu < uSize; iu++) {
            for (let iv = 0; iv < vSize; iv++) {
              const maskIndex = iu + iv * uSize;

              const x = axis === 0 ? d : u === 0 ? iu : iv;
              const y = axis === 1 ? d : u === 1 ? iu : iv;
              const z = axis === 2 ? d : u === 2 ? iu : iv;

              const blockValue = voxelData[x][y][z];
              const blockPresent = isBlockPresent(blockValue);
              const previewBlockValue = previewFrame.get(x, y, z);
              const blockIsPreview = previewBlockValue !== 0;
              const selectionBlockValue = selectionFrame.get(x, y, z);
              const blockIsSelected = selectionBlockValue !== 0;

              // Early continue for empty voxels
              if (!blockPresent && !blockIsPreview && !blockIsSelected) {
                continue;
              }

              const blockType = Math.max(
                getBlockType(blockIsPreview ? previewBlockValue : blockValue),
                1
              );

              const nx = x + (axis === 0 ? dir : 0);
              const ny = y + (axis === 1 ? dir : 0);
              const nz = z + (axis === 2 ? dir : 0);

              const neighborInBounds =
                axis === 0
                  ? isNeighborInBounds(axis, dir, nx, dimensions.x)
                  : axis === 1
                    ? isNeighborInBounds(axis, dir, ny, dimensions.y)
                    : isNeighborInBounds(axis, dir, nz, dimensions.z);

              const neighborValue = neighborInBounds ? voxelData[nx][ny][nz] : 0;
              const neighborIsPreview = neighborInBounds && previewFrame.get(nx, ny, nz) !== 0;

              if (blockIsPreview) {
                const shouldRenderFace =
                  !isBlockPresent(neighborValue) || !neighborIsPreview;

                if (shouldRenderFace) {
                  const textureIndex =
                    blockAtlasMappings[blockType - 1][faceDir];

                  this.aoMask[iv][iu] = calculateAmbientOcclusion(
                    nx,
                    ny,
                    nz,
                    faceDir,
                    voxelData,
                    dimensions,
                    previewFrame,
                    previewOccludes
                  );

                  this.previewMask[iv][iu] = textureIndex;
                  hasPreviewFaces = true;
                }
              } else if (blockIsSelected) {
                const neighborIsSelected = selectionFrame.isSet(nx, ny, nz);
                const shouldRenderSelectionFace = !neighborIsSelected;

                if (shouldRenderSelectionFace) {
                  const textureIndex =
                    blockAtlasMappings[blockType - 1][faceDir];
                  
                  this.aoMask[iv][iu] = calculateAmbientOcclusion(
                    nx,
                    ny,
                    nz,
                    faceDir,
                    voxelData,
                    dimensions,
                    previewFrame,
                    previewOccludes
                  );
                  
                  this.realMask[iv][iu] = textureIndex;
                  this.isSelectedMask[iv][iu] = 1;
                  hasRealFaces = true;
                }
              } else if (blockPresent) {
                const shouldRenderFace =
                  !isBlockPresent(neighborValue) || neighborIsPreview;

                if (shouldRenderFace) {
                  const textureIndex =
                    blockAtlasMappings[blockType - 1][faceDir];

                  this.aoMask[iv][iu] = calculateAmbientOcclusion(
                    nx,
                    ny,
                    nz,
                    faceDir,
                    voxelData,
                    dimensions,
                    previewFrame,
                    previewOccludes
                  );

                  this.realMask[iv][iu] = textureIndex;
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
    mask: Int16Array[],
    aoMask: Uint8Array[],
    isSelectedMask: Uint8Array[],
    processed: Uint8Array[],
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
    for (let iv = 0; iv < height; iv++) {
      processed[iv].fill(0, 0, width);
    }

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; ) {
        if (processed[j][i] || mask[j][i] < 0) {
          i++;
          continue;
        }

        const textureIndex = mask[j][i];
        const isSelected = isSelectedMask[j][i];
        let quadWidth = 1;
        if (!DISABLE_GREEDY_MESHING) {
          while (i + quadWidth < width) {
            if (
              processed[j][i + quadWidth] ||
              mask[j][i + quadWidth] !== textureIndex ||
              aoMask[j][i + quadWidth] !== aoMask[j][i] ||
              isSelectedMask[j][i + quadWidth] !== isSelected
            )
              break;
            quadWidth++;
          }
        }

        let quadHeight = 1;
        if (!DISABLE_GREEDY_MESHING) {
          outer: while (j + quadHeight < height) {
            for (let w = 0; w < quadWidth; w++) {
              if (
                processed[j + quadHeight][i + w] ||
                mask[j + quadHeight][i + w] !== textureIndex ||
                aoMask[j + quadHeight][i + w] !== aoMask[j][i] ||
                isSelectedMask[j + quadHeight][i + w] !== isSelected
              )
                break outer;
            }
            quadHeight++;
          }
        }

        const endI = i + quadWidth;
        const endJ = j + quadHeight;
        for (let jj = j; jj < endJ; jj++) {
          for (let ii = i; ii < endI; ii++) {
            processed[jj][ii] = 1;
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

        // Calculate and push vertices directly
        for (let vi = 0; vi < 4; vi++) {
          // Determine vertex coordinates based on vi and dir
          let actualVi = vi;
          if (dir < 0 && (vi === 1 || vi === 3)) {
            // Swap vertices 1 and 3 when dir < 0
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
            } else { // actualVi === 3
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
            } else { // actualVi === 3
              vx = x + (v === 0 ? quadHeight : 0);
              vz = z + (v === 2 ? quadHeight : 0);
            }
          } else { // axis === 2
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
            } else { // actualVi === 3
              vx = x + (v === 0 ? quadHeight : 0);
              vy = y + (v === 1 ? quadHeight : 0);
            }
          }

          meshArrays.pushVertex(vx, vy, vz);
          meshArrays.pushNormal(normal[0], normal[1], normal[2]);
          meshArrays.pushUV(textureCoords[vi * 2], textureCoords[vi * 2 + 1]);

          const packedAO = aoMask[j][i];

          // Faces 1, 2, 5 use swapped pattern [0, 3, 2, 1]
          // Faces 0, 3, 4 use standard pattern [0, 1, 2, 3]
          let aoCornerIndex: number;
          if (faceDir === 1 || faceDir === 2 || faceDir === 5) {
            // Swapped pattern for these faces
            aoCornerIndex = vi === 1 ? 3 : vi === 3 ? 1 : vi;
          } else {
            // Standard pattern - direct mapping
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
