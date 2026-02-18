import { describe, it, expect } from "vitest";
import { VoxelFrame } from "../voxel-frame";
import { BrushTool } from "../tools/brush-tool";
import type { ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode } from "@/state/types";
import type { Reducers } from "@/state/store";
import type { ProjectManager } from "../project-manager";
import * as THREE from "three";

function createBenchmarkContext(dimensions: Vector3, chunkSize: number): {
  context: ToolContext;
  setPreviewTimes: number[];
} {
  const attachMode: BlockModificationMode = { tag: "Attach" };
  const setPreviewTimes: number[] = [];

  const camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const reducers: Reducers = {
    addObject: () => {},
    deleteObject: () => {},
    renameObject: () => {},
    toggleObjectVisibility: () => {},
    toggleObjectLock: () => {},
    reorderObjects: () => {},
    applyFrame: () => {},
    undoEdit: () => {},
    updateCursorPos: () => {},
    magicSelect: () => {},
    commitSelectionMove: () => {},
    selectAllVoxels: () => {},
    deleteSelectedVoxels: () => {},
    updateBlockColor: () => {},
    setBlockColors: () => {},
    restoreObject: () => {},
  };

  type ChunkPreviewState = {
    sourceFrame: VoxelFrame | null;
    overlapMinX: number;
    overlapMinY: number;
    overlapMinZ: number;
    overlapMaxX: number;
    overlapMaxY: number;
    overlapMaxZ: number;
  };

  const chunkPreviewStates = new Map<string, ChunkPreviewState>();
  const chunksWithPreview = new Set<string>();

  const setPreview = (previewFrame: VoxelFrame) => {
    const start = performance.now();

    const frameMinPos = previewFrame.getMinPos();
    const frameMaxPos = previewFrame.getMaxPos();

    const minChunkX = Math.floor(frameMinPos.x / chunkSize) * chunkSize;
    const minChunkY = Math.floor(frameMinPos.y / chunkSize) * chunkSize;
    const minChunkZ = Math.floor(frameMinPos.z / chunkSize) * chunkSize;
    const maxChunkX = Math.floor((frameMaxPos.x - 1) / chunkSize) * chunkSize;
    const maxChunkY = Math.floor((frameMaxPos.y - 1) / chunkSize) * chunkSize;
    const maxChunkZ = Math.floor((frameMaxPos.z - 1) / chunkSize) * chunkSize;

    const currentChunksWithPreview = new Set<string>();

    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += chunkSize) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += chunkSize) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += chunkSize) {
          const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
          const sizeX = Math.min(chunkSize, dimensions.x - chunkX);
          const sizeY = Math.min(chunkSize, dimensions.y - chunkY);
          const sizeZ = Math.min(chunkSize, dimensions.z - chunkZ);

          const copyMinX = Math.max(chunkX, frameMinPos.x);
          const copyMinY = Math.max(chunkY, frameMinPos.y);
          const copyMinZ = Math.max(chunkZ, frameMinPos.z);
          const copyMaxX = Math.min(chunkX + sizeX, frameMaxPos.x);
          const copyMaxY = Math.min(chunkY + sizeY, frameMaxPos.y);
          const copyMaxZ = Math.min(chunkZ + sizeZ, frameMaxPos.z);

          let state = chunkPreviewStates.get(chunkKey);
          if (!state) {
            state = {
              sourceFrame: null,
              overlapMinX: 0, overlapMinY: 0, overlapMinZ: 0,
              overlapMaxX: 0, overlapMaxY: 0, overlapMaxZ: 0,
            };
            chunkPreviewStates.set(chunkKey, state);
          }
          state.sourceFrame = previewFrame;
          state.overlapMinX = copyMinX;
          state.overlapMinY = copyMinY;
          state.overlapMinZ = copyMinZ;
          state.overlapMaxX = copyMaxX;
          state.overlapMaxY = copyMaxY;
          state.overlapMaxZ = copyMaxZ;

          simulateMergePreviewDirect(
            previewFrame,
            sizeX, sizeY, sizeZ,
            chunkX, chunkY, chunkZ,
            copyMinX, copyMinY, copyMinZ,
            copyMaxX, copyMaxY, copyMaxZ
          );

          currentChunksWithPreview.add(chunkKey);
        }
      }
    }

    for (const chunkKey of chunksWithPreview) {
      if (!currentChunksWithPreview.has(chunkKey)) {
        const state = chunkPreviewStates.get(chunkKey);
        if (state) {
          state.sourceFrame = null;
        }
      }
    }
    chunksWithPreview.clear();
    for (const key of currentChunksWithPreview) {
      chunksWithPreview.add(key);
    }

    const elapsed = performance.now() - start;
    setPreviewTimes.push(elapsed);
  };

  const context: ToolContext = {
    reducers,
    projectId: "test-project",
    dimensions,
    projectManager: {
      applyOptimisticRectEdit: () => {},
      getBlockAtPosition: () => 1,
      updateMoveSelectionBox: () => {},
      clearMoveSelectionBox: () => {},
      chunkManager: {
        setPreview,
      },
    } as unknown as ProjectManager,
    previewFrame: new VoxelFrame(dimensions),
    selectedBlock: 1,
    selectedObject: 0,
    setSelectedBlockInParent: () => {},
    mode: attachMode,
    camera,
    scene: new THREE.Scene(),
  };

  return { context, setPreviewTimes };
}

function simulateMergePreviewDirect(
  sourceFrame: VoxelFrame,
  _sizeX: number,
  sizeY: number,
  sizeZ: number,
  chunkMinX: number,
  chunkMinY: number,
  chunkMinZ: number,
  overlapMinX: number,
  overlapMinY: number,
  overlapMinZ: number,
  overlapMaxX: number,
  overlapMaxY: number,
  overlapMaxZ: number,
): void {
  if (sourceFrame.isEmpty()) return;

  const sourceData = sourceFrame.getData();
  const sourceCapMinPos = sourceFrame.getCapMinPos();
  const sourceCapDims = sourceFrame.getCapDimensions();
  const sourceCapYZ = sourceCapDims.y * sourceCapDims.z;
  const sourceCapZ = sourceCapDims.z;

  const blocks = new Uint8Array(_sizeX * sizeY * sizeZ);

  for (let worldX = overlapMinX; worldX < overlapMaxX; worldX++) {
    const srcXOff = (worldX - sourceCapMinPos.x) * sourceCapYZ;
    const dstXOff = (worldX - chunkMinX) * sizeY * sizeZ;
    for (let worldY = overlapMinY; worldY < overlapMaxY; worldY++) {
      const srcXYOff = srcXOff + (worldY - sourceCapMinPos.y) * sourceCapZ;
      const dstXYOff = dstXOff + (worldY - chunkMinY) * sizeZ;
      for (let worldZ = overlapMinZ; worldZ < overlapMaxZ; worldZ++) {
        const pv = sourceData[srcXYOff + (worldZ - sourceCapMinPos.z)];
        if (pv !== 0) {
          blocks[dstXYOff + (worldZ - chunkMinZ)] = pv;
        }
      }
    }
  }
}

describe("Brush Tool Benchmark", () => {
  it("should benchmark brush stroke across a 64x64x64 world", () => {
    const dimensions = { x: 64, y: 64, z: 64 };
    const chunkSize = 32;
    const brushSize = 5;
    const iterations = 3;
    const allStrokeTimes: number[][] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const { context, setPreviewTimes } = createBenchmarkContext(dimensions, chunkSize);
      const tool = new BrushTool();
      tool.setOption("Brush Shape", "Sphere");
      tool.setOption("Size", String(brushSize));

      const strokePositions: THREE.Vector3[] = [];
      for (let i = 0; i < 30; i++) {
        strokePositions.push(new THREE.Vector3(
          5 + i * 2,
          32,
          32
        ));
      }

      tool.onMouseDown(context, {
        gridPosition: strokePositions[0],
        mousePosition: new THREE.Vector2(0, 0),
      });

      for (let i = 1; i < strokePositions.length; i++) {
        tool.onDrag(context, {
          startGridPosition: strokePositions[0],
          currentGridPosition: strokePositions[i],
          startMousePosition: new THREE.Vector2(0, 0),
          currentMousePosition: new THREE.Vector2(i * 0.03, 0),
        });
      }

      tool.onMouseUp(context, {
        startGridPosition: strokePositions[0],
        currentGridPosition: strokePositions[strokePositions.length - 1],
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(1, 0),
      });

      allStrokeTimes.push([...setPreviewTimes]);
    }

    const lastIterTimes = allStrokeTimes[allStrokeTimes.length - 1];
    const avgTime = lastIterTimes.reduce((a, b) => a + b, 0) / lastIterTimes.length;
    const maxTime = Math.max(...lastIterTimes);
    const lastFewAvg = lastIterTimes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, lastIterTimes.length);

    console.log(`Brush stroke 64x64x64 (size=${brushSize}, sphere):`);
    console.log(`  Steps: ${lastIterTimes.length}`);
    console.log(`  Avg setPreview: ${avgTime.toFixed(3)}ms`);
    console.log(`  Max setPreview: ${maxTime.toFixed(3)}ms`);
    console.log(`  Last 5 avg: ${lastFewAvg.toFixed(3)}ms`);

    expect(maxTime).toBeLessThan(50);
  });

  it("should benchmark brush stroke with large brush across 128x64x128 world", () => {
    const dimensions = { x: 128, y: 64, z: 128 };
    const chunkSize = 32;
    const brushSize = 10;
    const iterations = 3;
    const allStrokeTimes: number[][] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const { context, setPreviewTimes } = createBenchmarkContext(dimensions, chunkSize);
      const tool = new BrushTool();
      tool.setOption("Brush Shape", "Sphere");
      tool.setOption("Size", String(brushSize));

      const strokePositions: THREE.Vector3[] = [];
      for (let i = 0; i < 40; i++) {
        strokePositions.push(new THREE.Vector3(
          10 + i * 3,
          32,
          10 + i * 3
        ));
      }

      tool.onMouseDown(context, {
        gridPosition: strokePositions[0],
        mousePosition: new THREE.Vector2(0, 0),
      });

      for (let i = 1; i < strokePositions.length; i++) {
        tool.onDrag(context, {
          startGridPosition: strokePositions[0],
          currentGridPosition: strokePositions[i],
          startMousePosition: new THREE.Vector2(0, 0),
          currentMousePosition: new THREE.Vector2(i * 0.025, i * 0.025),
        });
      }

      tool.onMouseUp(context, {
        startGridPosition: strokePositions[0],
        currentGridPosition: strokePositions[strokePositions.length - 1],
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(1, 1),
      });

      allStrokeTimes.push([...setPreviewTimes]);
    }

    const lastIterTimes = allStrokeTimes[allStrokeTimes.length - 1];
    const avgTime = lastIterTimes.reduce((a, b) => a + b, 0) / lastIterTimes.length;
    const maxTime = Math.max(...lastIterTimes);
    const lastFewAvg = lastIterTimes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, lastIterTimes.length);

    console.log(`Brush stroke 128x64x128 (size=${brushSize}, sphere):`);
    console.log(`  Steps: ${lastIterTimes.length}`);
    console.log(`  Avg setPreview: ${avgTime.toFixed(3)}ms`);
    console.log(`  Max setPreview: ${maxTime.toFixed(3)}ms`);
    console.log(`  Last 5 avg: ${lastFewAvg.toFixed(3)}ms`);

    expect(maxTime).toBeLessThan(50);
  });
});
