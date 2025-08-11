import {
  Atlas,
  BlockModificationMode,
  ProjectBlocks,
  Vector3,
} from "@/module_bindings";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { MeshArrays } from "./mesh-arrays";

const getBlockType = (blockValue: number): number => {
  return (blockValue >> 6) & 0x3ff;
};

const isBlockPresent = (blockValue: number): boolean => {
  return blockValue !== 0;
};

const isPreview = (blockValue: number): boolean => {
  return (blockValue & 0x08) !== 0;
};

export const findExteriorFaces = (
  chunkData: Uint16Array[][],
  previewMode: BlockModificationMode,
  atlas: Atlas,
  projectBlocks: ProjectBlocks,
  chunkDimensions: Vector3,
  meshArrays: MeshArrays,
  previewMeshArrays: MeshArrays
): void => {
  const isEraseMode = previewMode.tag === BlockModificationMode.Erase.tag;
  const isBuildMode = previewMode.tag === BlockModificationMode.Build.tag;
  const isPaintMode = previewMode.tag === BlockModificationMode.Paint.tag;

  meshArrays.reset();
  previewMeshArrays.reset();

  const maskSize =
    Math.max(chunkDimensions.x, chunkDimensions.y, chunkDimensions.z) ** 2;
  const realMask = new Int16Array(maskSize);
  const previewMask = new Int16Array(maskSize);
  const processed = new Uint8Array(maskSize);

  const getNeighborBlock = (x: number, y: number, z: number): number | null => {
    if (
      x >= 0 &&
      x < chunkDimensions.x &&
      y >= 0 &&
      y < chunkDimensions.y &&
      z >= 0 &&
      z < chunkDimensions.z
    ) {
      return chunkData[x][y][z];
    }

    return 0;
  };

  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;

    const axisSize =
      axis === 0
        ? chunkDimensions.x
        : axis === 1
        ? chunkDimensions.y
        : chunkDimensions.z;
    const uSize =
      u === 0
        ? chunkDimensions.x
        : u === 1
        ? chunkDimensions.y
        : chunkDimensions.z;
    const vSize =
      v === 0
        ? chunkDimensions.x
        : v === 1
        ? chunkDimensions.y
        : chunkDimensions.z;

    for (let dir = -1; dir <= 1; dir += 2) {
      const faceDir = axis * 2 + (dir > 0 ? 0 : 1);

      for (let d = 0; d < axisSize; d++) {
        realMask.fill(-1, 0, uSize * vSize);
        previewMask.fill(-1, 0, uSize * vSize);

        for (let iu = 0; iu < uSize; iu++) {
          for (let iv = 0; iv < vSize; iv++) {
            const maskIndex = iu + iv * uSize;

            const x = axis === 0 ? d : u === 0 ? iu : iv;
            const y = axis === 1 ? d : u === 1 ? iu : iv;
            const z = axis === 2 ? d : u === 2 ? iu : iv;

            const blockValue = chunkData[x][y][z];
            const blockPresent = isBlockPresent(blockValue);
            const blockIsPreview = isPreview(blockValue);
            const blockType = getBlockType(blockValue);

            const nx = x + (axis === 0 ? dir : 0);
            const ny = y + (axis === 1 ? dir : 0);
            const nz = z + (axis === 2 ? dir : 0);
            const neighborValue = getNeighborBlock(nx, ny, nz);

            if (blockPresent) {
              let shouldShowFace = false;

              if (neighborValue === null) {
                shouldShowFace = true;
              } else {
                const neighborPresent = isBlockPresent(neighborValue);
                const neighborIsPreview = isPreview(neighborValue);

                shouldShowFace = !neighborPresent || neighborIsPreview;
              }

              if (shouldShowFace) {
                const textureIndex =
                  projectBlocks.blockFaceAtlasIndexes[blockType - 1][faceDir];

                if (blockIsPreview) {
                  if (isPaintMode && !isPreview) {
                    previewMask[maskIndex] = textureIndex;
                  } else if (isEraseMode && !blockIsPreview) {
                    // Don't show preview - nothing to erase
                  } else {
                    previewMask[maskIndex] = textureIndex;
                  }
                } else {
                  realMask[maskIndex] = textureIndex;
                }
              }
            }
          }
        }

        generateGreedyMesh(
          realMask,
          processed,
          uSize,
          vSize,
          d,
          axis,
          u,
          v,
          dir,
          faceDir,
          atlas,
          meshArrays
        );
        generateGreedyMesh(
          previewMask,
          processed,
          uSize,
          vSize,
          d,
          axis,
          u,
          v,
          dir,
          faceDir,
          atlas,
          previewMeshArrays
        );
      }
    }
  }
};

const generateGreedyMesh = (
  mask: Int16Array,
  processed: Uint8Array,
  width: number,
  height: number,
  depth: number,
  axis: number,
  u: number,
  v: number,
  dir: number,
  faceDir: number,
  atlas: Atlas,
  meshArrays: MeshArrays
): void => {
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
      while (i + quadWidth < width) {
        const idx = i + quadWidth + j * width;
        if (processed[idx] || mask[idx] !== textureIndex) break;
        quadWidth++;
      }

      let quadHeight = 1;
      outer: while (j + quadHeight < height) {
        for (let w = 0; w < quadWidth; w++) {
          const idx = i + w + (j + quadHeight) * width;
          if (processed[idx] || mask[idx] !== textureIndex) break outer;
        }
        quadHeight++;
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

      const textureCoords = getTextureCoordinates(
        textureIndex,
        atlas.gridSize,
        atlas.cellPixelWidth
      );

      const faceData = faces[faceDir];
      const normal = faceData.normal;

      const startVertexIndex = meshArrays.vertexCount;

      for (let vi = 0; vi < 4; vi++) {
        const vertex = vertices[vi];
        meshArrays.pushVertex(vertex[0], vertex[1], vertex[2]);
        meshArrays.pushNormal(normal[0], normal[1], normal[2]);
        meshArrays.pushUV(textureCoords[vi * 2], textureCoords[vi * 2 + 1]);
        meshArrays.pushAO(1.0);
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
};
