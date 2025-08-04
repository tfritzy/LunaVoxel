import { Atlas, BlockModificationMode, ProjectBlocks } from "@/module_bindings";
import * as THREE from "three";
import { VoxelFaces } from "./layer-mesh";
import { Block } from "./blocks";

export const findExteriorFaces = (
  realBlocks: (Block | undefined)[][][],
  previewBlocks: (Block | undefined)[][][],
  previewMode: BlockModificationMode,
  atlas: Atlas,
  blocks: ProjectBlocks,
  dimensions: { xDim: number; yDim: number; zDim: number }
): {
  meshFaces: Map<string, VoxelFaces>;
  previewFaces: Map<string, VoxelFaces>;
} => {
  const { xDim, yDim, zDim } = dimensions;

  const getBlock = (x: number, y: number, z: number): Block | undefined => {
    return realBlocks[x]?.[y]?.[z];
  };

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

  const exteriorFacesMap = new Map<string, VoxelFaces>();
  const previewFacesMap = new Map<string, VoxelFaces>();

  const exteriorFacesList: Array<{ key: string; textureIndex: number; faceIndex: number; gridPos: THREE.Vector3 }> = [];
  const previewFacesList: Array<{ key: string; textureIndex: number; faceIndex: number; gridPos: THREE.Vector3 }> = [];

  const start = performance.now();

  for (let x = 0; x < xDim; x++) {
    for (let y = 0; y < yDim; y++) {
      for (let z = 0; z < zDim; z++) {
        const block = getBlock(x, y, z);
        const previewBlock = getPreviewBlock(x, y, z);
        const hasReal = !!block;
        const hasPreview = !!previewBlock;

        if (hasReal && (isBuildMode || !hasPreview)) {
          const blockTemplate = blocks.blockFaceAtlasIndexes[block.type - 1];

          for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
            const dir = directions[dirIndex];
            const nx = x + dir[0];
            const ny = y + dir[1];
            const nz = z + dir[2];

            const neighborBlock = getBlock(nx, ny, nz);
            const neighborPreview = getPreviewBlock(nx, ny, nz);
            const neighborHasReal = !!neighborBlock;
            const neighborHasPreview = !!neighborPreview;

            const shouldShowFace =
              !neighborHasReal ||
              (isEraseMode && neighborHasPreview) ||
              (isPaintMode && neighborHasPreview && !neighborHasReal);

            if (shouldShowFace) {
              const index = blockTemplate[dirIndex];
              const key = `${x},${y},${z},${index}`;

              exteriorFacesList.push({
                key,
                textureIndex: index,
                faceIndex: dirIndex,
                gridPos: new THREE.Vector3(x, y, z)
              });
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

            const neighborBlock = getBlock(nx, ny, nz);
            const neighborPreview = getPreviewBlock(nx, ny, nz);
            const neighborHasReal = !!neighborBlock;
            const neighborHasPreview = !!neighborPreview;

            const shouldShowFace =
              !neighborHasReal ||
              (isEraseMode && neighborHasPreview) ||
              (isPaintMode && neighborHasPreview && !neighborHasReal);

            if (shouldShowFace) {
              const index = blueprint[dirIndex];
              const key = `${x},${y},${z},${index}`;

              previewFacesList.push({
                key,
                textureIndex: index,
                faceIndex: dirIndex,
                gridPos: new THREE.Vector3(x, y, z)
              });
            }
          }
        }
      }
    }
  }

  for (const face of exteriorFacesList) {
    let voxelFaces = exteriorFacesMap.get(face.key);
    if (!voxelFaces) {
      voxelFaces = {
        textureIndex: face.textureIndex,
        faceIndexes: [],
        gridPos: face.gridPos,
      };
      exteriorFacesMap.set(face.key, voxelFaces);
    }
    voxelFaces.faceIndexes.push(face.faceIndex);
  }

  for (const face of previewFacesList) {
    let voxelFaces = previewFacesMap.get(face.key);
    if (!voxelFaces) {
      voxelFaces = {
        textureIndex: face.textureIndex,
        faceIndexes: [],
        gridPos: face.gridPos,
      };
      previewFacesMap.set(face.key, voxelFaces);
    }
    voxelFaces.faceIndexes.push(face.faceIndex);
  }

  const totalTime = performance.now() - start;

  console.log('[findExteriorFaces] Optimized profile:', {
    totalTime: totalTime.toFixed(2) + 'ms',
    dimensions: `${xDim}x${yDim}x${zDim}`,
    facesGenerated: exteriorFacesMap.size + previewFacesMap.size,
  });

  return { meshFaces: exteriorFacesMap, previewFaces: previewFacesMap };
};