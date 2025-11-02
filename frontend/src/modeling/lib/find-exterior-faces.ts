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
  private realMask: Int16Array;
  private previewMask: Int16Array;
  private selectionMask: Int16Array;
  private processed: Uint8Array;
  private aoMask: Uint8Array;
  private maskSize: number;

  constructor(maxDimension: number) {
    this.maskSize = maxDimension ** 2;
    this.realMask = new Int16Array(this.maskSize);
    this.previewMask = new Int16Array(this.maskSize);
    this.selectionMask = new Int16Array(this.maskSize);
    this.processed = new Uint8Array(this.maskSize);
    this.aoMask = new Uint8Array(this.maskSize);
  }

  public findExteriorFaces(
    voxelData: Uint8Array[][],
    textureWidth: number,
    blockAtlasMappings: number[][],
    dimensions: Vector3,
    meshArrays: MeshArrays,
    previewMeshArrays: MeshArrays,
    selectionMeshArrays: MeshArrays,
    previewFrame: VoxelFrame,
    selectionFrame: VoxelFrame,
    previewOccludes: boolean
  ): void {
    meshArrays.reset();
    previewMeshArrays.reset();
    selectionMeshArrays.reset();

    const currentMaskSize =
      Math.max(dimensions.x, dimensions.y, dimensions.z) ** 2;

    if (currentMaskSize > this.maskSize) {
      this.maskSize = currentMaskSize;
      this.realMask = new Int16Array(this.maskSize);
      this.previewMask = new Int16Array(this.maskSize);
      this.selectionMask = new Int16Array(this.maskSize);
      this.processed = new Uint8Array(this.maskSize);
      this.aoMask = new Uint8Array(this.maskSize);
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
          this.realMask.fill(-1, 0, uSize * vSize);
          this.previewMask.fill(-1, 0, uSize * vSize);
          this.selectionMask.fill(-1, 0, uSize * vSize);
          this.aoMask.fill(0, 0, uSize * vSize);

          let hasRealFaces = false;
          let hasPreviewFaces = false;
          let hasSelectionFaces = false;

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

              if (blockPresent || blockIsPreview) {
                let shouldRenderFace = false;

                if (blockIsPreview) {
                  shouldRenderFace =
                    !isBlockPresent(neighborValue) || !neighborIsPreview;
                } else {
                  shouldRenderFace =
                    !isBlockPresent(neighborValue) || neighborIsPreview;
                }

                if (shouldRenderFace) {
                  const textureIndex =
                    blockAtlasMappings[blockType - 1][faceDir];

                  this.aoMask[maskIndex] = calculateAmbientOcclusion(
                    nx,
                    ny,
                    nz,
                    faceDir,
                    voxelData,
                    dimensions,
                    previewFrame,
                    previewOccludes
                  );

                  if (blockIsPreview) {
                    this.previewMask[maskIndex] = textureIndex;
                    hasPreviewFaces = true;
                  } else {
                    this.realMask[maskIndex] = textureIndex;
                    hasRealFaces = true;
                  }
                }

                if (blockIsSelected) {
                  const neighborIsSelected = selectionFrame.isEmpty()
                    ? false
                    : selectionFrame.isSet(nx, ny, nz);
                  const shouldRenderSelectionFace = !neighborIsSelected;

                  if (shouldRenderSelectionFace) {
                    const textureIndex =
                      blockAtlasMappings[blockType - 1][faceDir];
                    this.selectionMask[maskIndex] = textureIndex;
                    hasSelectionFaces = true;
                  }
                }
              }
            }
          }

          if (hasRealFaces) {
            this.generateGreedyMesh(
              this.realMask,
              this.aoMask,
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
          if (hasSelectionFaces) {
            this.generateGreedyMesh(
              this.selectionMask,
              this.aoMask,
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
              selectionMeshArrays
            );
          }
        }
      }
    }
  }

  private generateGreedyMesh(
    mask: Int16Array,
    aoMask: Uint8Array,
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
    processed.fill(0, 0, width * height);

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; ) {
        const maskIndex = i + j * width;

        if (processed[maskIndex] || mask[maskIndex] < 0) {
          i++;
          continue;
        }

        const textureIndex = mask[maskIndex];
        let quadWidth = 1;
        if (!DISABLE_GREEDY_MESHING) {
          while (i + quadWidth < width) {
            const idx = i + quadWidth + j * width;
            if (
              processed[idx] ||
              mask[idx] !== textureIndex ||
              aoMask[idx] !== aoMask[maskIndex]
            )
              break;
            quadWidth++;
          }
        }

        let quadHeight = 1;
        if (!DISABLE_GREEDY_MESHING) {
          outer: while (j + quadHeight < height) {
            for (let w = 0; w < quadWidth; w++) {
              const idx = i + w + (j + quadHeight) * width;
              if (
                processed[idx] ||
                mask[idx] !== textureIndex ||
                aoMask[idx] !== aoMask[maskIndex]
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
            processed[ii + jj * width] = 1;
          }
        }

        const x = axis === 0 ? depth : u === 0 ? i : v === 0 ? j : 0;
        const y = axis === 1 ? depth : u === 1 ? i : v === 1 ? j : 0;
        const z = axis === 2 ? depth : u === 2 ? i : v === 2 ? j : 0;

        const faceOffset = dir > 0 ? 1 : 0;

        const vertices: number[][] = [
          [x, y, z],
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ];

        if (axis === 0) {
          vertices[0][0] = x + faceOffset;
          vertices[1][0] = x + faceOffset;
          vertices[1][1] = y + (u === 1 ? quadWidth : 0);
          vertices[1][2] = z + (u === 2 ? quadWidth : 0);

          vertices[2][0] = x + faceOffset;
          vertices[2][1] = y + (u === 1 ? quadWidth : v === 1 ? quadHeight : 0);
          vertices[2][2] = z + (u === 2 ? quadWidth : v === 2 ? quadHeight : 0);

          vertices[3][0] = x + faceOffset;
          vertices[3][1] = y + (v === 1 ? quadHeight : 0);
          vertices[3][2] = z + (v === 2 ? quadHeight : 0);
        } else if (axis === 1) {
          vertices[0][1] = y + faceOffset;
          vertices[1][0] = x + (u === 0 ? quadWidth : 0);
          vertices[1][1] = y + faceOffset;
          vertices[1][2] = z + (u === 2 ? quadWidth : 0);

          vertices[2][0] = x + (u === 0 ? quadWidth : v === 0 ? quadHeight : 0);
          vertices[2][1] = y + faceOffset;
          vertices[2][2] = z + (u === 2 ? quadWidth : v === 2 ? quadHeight : 0);

          vertices[3][0] = x + (v === 0 ? quadHeight : 0);
          vertices[3][1] = y + faceOffset;
          vertices[3][2] = z + (v === 2 ? quadHeight : 0);
        } else {
          vertices[0][2] = z + faceOffset;
          vertices[1][0] = x + (u === 0 ? quadWidth : 0);
          vertices[1][1] = y + (u === 1 ? quadWidth : 0);
          vertices[1][2] = z + faceOffset;

          vertices[2][0] = x + (u === 0 ? quadWidth : v === 0 ? quadHeight : 0);
          vertices[2][1] = y + (u === 1 ? quadWidth : v === 1 ? quadHeight : 0);
          vertices[2][2] = z + faceOffset;

          vertices[3][0] = x + (v === 0 ? quadHeight : 0);
          vertices[3][1] = y + (v === 1 ? quadHeight : 0);
          vertices[3][2] = z + faceOffset;
        }

        if (dir < 0) {
          const temp = vertices[1];
          vertices[1] = vertices[3];
          vertices[3] = temp;
        }

        const textureCoords = getTextureCoordinates(textureIndex, textureWidth);

        const faceData = faces[faceDir];
        const normal = faceData.normal;

        const startVertexIndex = meshArrays.vertexCount;

        // Apply AO to vertices
        for (let vi = 0; vi < 4; vi++) {
          const vertex = vertices[vi];
          meshArrays.pushVertex(vertex[0], vertex[1], vertex[2]);
          meshArrays.pushNormal(normal[0], normal[1], normal[2]);
          meshArrays.pushUV(textureCoords[vi * 2], textureCoords[vi * 2 + 1]);

          const packedAO = aoMask[maskIndex];

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
