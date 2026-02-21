import { describe, it, expect } from "vitest";
import { BrushTool } from "../tools/brush-tool";
import type { ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode } from "@/state/types";
import type { Reducers, StateStore } from "@/state/store";
import type { ProjectManager } from "../project-manager";
import * as THREE from "three";
import { CHUNK_SIZE } from "@/state/constants";

function createBenchmarkContext(dimensions: Vector3): {
  context: ToolContext;
  updatePreviewTimes: number[];
} {
  const attachMode: BlockModificationMode = { tag: "Attach" };
  const updatePreviewTimes: number[] = [];
  const previewBuffer = new Uint8Array(dimensions.x * dimensions.y * dimensions.z);

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
    moveSelection: () => {},
    moveObject: () => {},
    beginSelectionMove: () => {},
    commitSelectionMove: () => {},
    selectAllVoxels: () => {},
    deleteSelectedVoxels: () => {},
    updateBlockColor: () => {},
    setBlockColors: () => {},
    restoreObject: () => {},
    setSelectedObject: () => {},
  };

  const chunkBounds: Map<string, { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }> = new Map();

  const updatePreview = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => {
    const start = performance.now();

    const minChunkX = Math.floor(minX / CHUNK_SIZE) * CHUNK_SIZE;
    const minChunkY = Math.floor(minY / CHUNK_SIZE) * CHUNK_SIZE;
    const minChunkZ = Math.floor(minZ / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkX = Math.floor(maxX / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkY = Math.floor(maxY / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkZ = Math.floor(maxZ / CHUNK_SIZE) * CHUNK_SIZE;

    const worldYZ = dimensions.y * dimensions.z;
    const worldZ = dimensions.z;

    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += CHUNK_SIZE) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += CHUNK_SIZE) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += CHUNK_SIZE) {
          const sizeX = Math.min(CHUNK_SIZE, dimensions.x - chunkX);
          const sizeY = Math.min(CHUNK_SIZE, dimensions.y - chunkY);
          const sizeZ = Math.min(CHUNK_SIZE, dimensions.z - chunkZ);

          const key = `${chunkX},${chunkY},${chunkZ}`;
          const localMinX = Math.max(0, minX - chunkX);
          const localMinY = Math.max(0, minY - chunkY);
          const localMinZ = Math.max(0, minZ - chunkZ);
          const localMaxX = Math.min(sizeX - 1, maxX - chunkX);
          const localMaxY = Math.min(sizeY - 1, maxY - chunkY);
          const localMaxZ = Math.min(sizeZ - 1, maxZ - chunkZ);

          const existing = chunkBounds.get(key);
          if (existing) {
            existing.minX = Math.min(existing.minX, localMinX);
            existing.minY = Math.min(existing.minY, localMinY);
            existing.minZ = Math.min(existing.minZ, localMinZ);
            existing.maxX = Math.max(existing.maxX, localMaxX);
            existing.maxY = Math.max(existing.maxY, localMaxY);
            existing.maxZ = Math.max(existing.maxZ, localMaxZ);
          } else {
            chunkBounds.set(key, { minX: localMinX, minY: localMinY, minZ: localMinZ, maxX: localMaxX, maxY: localMaxY, maxZ: localMaxZ });
          }

          const acc = chunkBounds.get(key)!;
          const blocks = new Uint8Array(sizeX * sizeY * sizeZ);
          for (let lx = acc.minX; lx <= acc.maxX; lx++) {
            const srcXOff = (chunkX + lx) * worldYZ;
            const dstXOff = lx * sizeY * sizeZ;
            for (let ly = acc.minY; ly <= acc.maxY; ly++) {
              const srcXYOff = srcXOff + (chunkY + ly) * worldZ;
              const dstXYOff = dstXOff + ly * sizeZ;
              for (let lz = acc.minZ; lz <= acc.maxZ; lz++) {
                const pv = previewBuffer[srcXYOff + chunkZ + lz];
                if (pv !== 0) {
                  blocks[dstXYOff + lz] = pv;
                }
              }
            }
          }
        }
      }
    }

    updatePreviewTimes.push(performance.now() - start);
  };

  const clearPreview = () => {
    chunkBounds.clear();
  };

  const mockObjects = [{
    id: "bench-obj",
    projectId: "test-project",
    name: "Object 1",
    visible: true,
    locked: false,
    position: { x: 0, y: 0, z: 0 },
    dimensions,
    selection: null,
  }];

  const mockStateStore = {
    getState: () => ({
      project: { id: "test-project", dimensions },
      objects: mockObjects,
      selectedObject: "bench-obj",
      blocks: { projectId: "test-project", colors: [] },
      chunks: new Map(),
    }),
    subscribe: () => () => {},
    reducers,
  } as StateStore;

  const context: ToolContext = {
    stateStore: mockStateStore,
    reducers,
    projectId: "test-project",
    projectManager: {
      applyOptimisticRectEdit: () => {},
      getBlockAtPosition: () => 1,
      chunkManager: {
        updatePreview,
        clearPreview,
        previewBuffer,
        getDimensions: () => dimensions,
      },
    } as unknown as ProjectManager,
    previewBuffer,
    selectedBlock: 1,
    setSelectedBlockInParent: () => {},
    mode: attachMode,
    camera,
    scene: new THREE.Scene(),
  };

  return { context, updatePreviewTimes };
}

describe("Brush Tool Benchmark", () => {
  it("should benchmark brush stroke across a 64x64x64 world", () => {
    const dimensions = { x: 64, y: 64, z: 64 };
    const brushSize = 5;
    const iterations = 3;
    const allStrokeTimes: number[][] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const { context, updatePreviewTimes } = createBenchmarkContext(dimensions);
      const tool = new BrushTool();
      tool.setOption("Brush Shape", "Sphere");
      tool.setOption("Size", String(brushSize));

      const strokePositions: THREE.Vector3[] = [];
      for (let i = 0; i < 30; i++) {
        strokePositions.push(new THREE.Vector3(5 + i * 2, 32, 32));
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

      allStrokeTimes.push([...updatePreviewTimes]);
    }

    const lastIterTimes = allStrokeTimes[allStrokeTimes.length - 1];
    const avgTime = lastIterTimes.reduce((a, b) => a + b, 0) / lastIterTimes.length;
    const maxTime = Math.max(...lastIterTimes);
    const lastFewAvg = lastIterTimes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, lastIterTimes.length);

    console.log(`Brush stroke 64x64x64 (size=${brushSize}, sphere):`);
    console.log(`  Steps: ${lastIterTimes.length}`);
    console.log(`  Avg updatePreview: ${avgTime.toFixed(3)}ms`);
    console.log(`  Max updatePreview: ${maxTime.toFixed(3)}ms`);
    console.log(`  Last 5 avg: ${lastFewAvg.toFixed(3)}ms`);

    expect(maxTime).toBeLessThan(50);
  });

  it("should benchmark brush stroke with large brush across 128x64x128 world", () => {
    const dimensions = { x: 128, y: 64, z: 128 };
    const brushSize = 10;
    const iterations = 3;
    const allStrokeTimes: number[][] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const { context, updatePreviewTimes } = createBenchmarkContext(dimensions);
      const tool = new BrushTool();
      tool.setOption("Brush Shape", "Sphere");
      tool.setOption("Size", String(brushSize));

      const strokePositions: THREE.Vector3[] = [];
      for (let i = 0; i < 40; i++) {
        strokePositions.push(new THREE.Vector3(10 + i * 3, 32, 10 + i * 3));
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

      allStrokeTimes.push([...updatePreviewTimes]);
    }

    const lastIterTimes = allStrokeTimes[allStrokeTimes.length - 1];
    const avgTime = lastIterTimes.reduce((a, b) => a + b, 0) / lastIterTimes.length;
    const maxTime = Math.max(...lastIterTimes);
    const lastFewAvg = lastIterTimes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, lastIterTimes.length);

    console.log(`Brush stroke 128x64x128 (size=${brushSize}, sphere):`);
    console.log(`  Steps: ${lastIterTimes.length}`);
    console.log(`  Avg updatePreview: ${avgTime.toFixed(3)}ms`);
    console.log(`  Max updatePreview: ${maxTime.toFixed(3)}ms`);
    console.log(`  Last 5 avg: ${lastFewAvg.toFixed(3)}ms`);

    expect(maxTime).toBeLessThan(50);
  });
});
