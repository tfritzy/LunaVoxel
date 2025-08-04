import { Atlas, BlockModificationMode, ProjectBlocks, Vector3 } from "@/module_bindings";
import * as THREE from "three";
import { Block } from "./blocks";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { calculateVertexAO } from "./ambient-occlusion";
import { MeshArrays } from "./mesh-arrays";

export const findExteriorFaces = (
  realBlocks: (Block | undefined)[][][],
  previewBlocks: (Block | undefined)[][][],
  previewMode: BlockModificationMode,
  atlas: Atlas,
  blocks: ProjectBlocks,
  dimensions: Vector3,
  meshArrays: MeshArrays,
  previewMeshArrays: MeshArrays
): void => {

  const getPreviewBlock = (x: number, y: number, z: number): Block | undefined => {
    return previewBlocks?.[x]?.[y]?.[z];
  };

  const directions = [
    [1, 0, 0],   // +X
    [-1, 0, 0],  // -X
    [0, 1, 0],   // +Y
    [0, -1, 0],  // -Y
    [0, 0, 1],   // +Z
    [0, 0, -1],  // -Z
  ];

  const isEraseMode = previewMode.tag === BlockModificationMode.Erase.tag;
  const isBuildMode = previewMode.tag === BlockModificationMode.Build.tag;
  const isPaintMode = previewMode.tag === BlockModificationMode.Paint.tag;

  meshArrays.reset();
  previewMeshArrays.reset();

  const start = performance.now();

  for (let x = 0; x < dimensions.x; x++) {
    for (let y = 0; y < dimensions.y; y++) {
      for (let z = 0; z < dimensions.z; z++) {
        const block = realBlocks[x]?.[y]?.[z];
        const previewBlock = previewBlocks?.[x]?.[y]?.[z];
        const hasReal = !!block;
        const hasPreview = !!previewBlock;

        const posX = x + 0.5;
        const posY = y + 0.5;
        const posZ = z + 0.5;

        if (hasReal && (isBuildMode || !hasPreview)) {
          const blockTemplate = blocks.blockFaceAtlasIndexes[block.type - 1];

          for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
            const dir = directions[dirIndex];
            const nx = x + dir[0];
            const ny = y + dir[1];
            const nz = z + dir[2];

            const neighborBlock = realBlocks[nx]?.[ny]?.[nz];
            const neighborPreview = previewBlocks?.[nx]?.[ny]?.[nz];
            const neighborHasReal = !!neighborBlock;
            const neighborHasPreview = !!neighborPreview;

            const shouldShowFace =
              !neighborHasReal ||
              (isEraseMode && neighborHasPreview) ||
              (isPaintMode && neighborHasPreview && !neighborHasReal);

            if (shouldShowFace) {
              const textureIndex = blockTemplate[dirIndex];
              const textureCoords = getTextureCoordinates(
                textureIndex,
                atlas.gridSize,
                atlas.cellPixelWidth
              );

              const face = faces[dirIndex];
              const faceVertices = face.vertices;
              const faceNormal = face.normal;
              const normalX = faceNormal[0];
              const normalY = faceNormal[1];
              const normalZ = faceNormal[2];

              const startVertexIndex = meshArrays.vertexCount;

              for (let j = 0; j < 4; j++) {
                const vertex = faceVertices[j];
                const aoFactor = calculateVertexAO(
                  x,
                  y,
                  z,
                  dirIndex,
                  j,
                  realBlocks,
                  previewBlocks,
                  previewMode
                );

                meshArrays.pushVertex(vertex[0] + posX, vertex[1] + posY, vertex[2] + posZ);
                meshArrays.pushNormal(normalX, normalY, normalZ);
                meshArrays.pushUV(textureCoords[j * 2], textureCoords[j * 2 + 1]);
                meshArrays.pushAO(aoFactor);
                meshArrays.incrementVertex();
              }

              meshArrays.pushIndex(startVertexIndex);
              meshArrays.pushIndex(startVertexIndex + 1);
              meshArrays.pushIndex(startVertexIndex + 2);
              meshArrays.pushIndex(startVertexIndex);
              meshArrays.pushIndex(startVertexIndex + 2);
              meshArrays.pushIndex(startVertexIndex + 3);
            }
          }
        }

        if (hasPreview) {
          if (isPaintMode && !hasReal) {
            continue;
          }

          const blueprint = blocks.blockFaceAtlasIndexes[previewBlock.type - 1];

          for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
            const dir = directions[dirIndex];
            const nx = x + dir[0];
            const ny = y + dir[1];
            const nz = z + dir[2];

            const neighborBlock = realBlocks[nx]?.[ny]?.[nz];
            const neighborPreview = getPreviewBlock(nx, ny, nz);
            const neighborHasReal = !!neighborBlock;
            const neighborHasPreview = !!neighborPreview;

            const shouldShowFace =
              !neighborHasReal ||
              (isEraseMode && neighborHasPreview) ||
              (isPaintMode && neighborHasPreview && !neighborHasReal);

            if (shouldShowFace) {
              const textureIndex = blueprint[dirIndex];
              const textureCoords = getTextureCoordinates(
                textureIndex,
                atlas.gridSize,
                atlas.cellPixelWidth
              );

              const face = faces[dirIndex];
              const faceVertices = face.vertices;
              const faceNormal = face.normal;
              const normalX = faceNormal[0];
              const normalY = faceNormal[1];
              const normalZ = faceNormal[2];

              const startVertexIndex = previewMeshArrays.vertexCount;

              for (let j = 0; j < 4; j++) {
                const vertex = faceVertices[j];

                previewMeshArrays.pushVertex(vertex[0] + posX, vertex[1] + posY, vertex[2] + posZ);
                previewMeshArrays.pushNormal(normalX, normalY, normalZ);
                previewMeshArrays.pushUV(textureCoords[j * 2], textureCoords[j * 2 + 1]);
                previewMeshArrays.pushAO(1.0);
                previewMeshArrays.incrementVertex();
              }

              previewMeshArrays.pushIndex(startVertexIndex);
              previewMeshArrays.pushIndex(startVertexIndex + 1);
              previewMeshArrays.pushIndex(startVertexIndex + 2);
              previewMeshArrays.pushIndex(startVertexIndex);
              previewMeshArrays.pushIndex(startVertexIndex + 2);
              previewMeshArrays.pushIndex(startVertexIndex + 3);
            }
          }
        }
      }
    }
  }

  const totalTime = performance.now() - start;

  console.log('[findExteriorFaces] Optimized profile:', {
    totalTime: totalTime.toFixed(2) + 'ms',
    dimensions: `${dimensions.x}x${dimensions.y}x${dimensions.z}`,
    meshVertices: meshArrays.vertexCount,
    previewVertices: previewMeshArrays.vertexCount,
  });
};