import { describe, it, expect } from "vitest";
import { BrushTool } from "../tools/brush-tool";
import type { ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode } from "@/state/types";
import type { Reducers } from "@/state/store";
import type { ProjectManager } from "../project-manager";
import * as THREE from "three";
import { wrapCoord } from "../tools/tool-utils";

function createTestContext(dimensions: Vector3): ToolContext {
  const attachMode: BlockModificationMode = { tag: "Attach" };
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
    commitSelectionMove: () => {},
    selectAllVoxels: () => {},
    deleteSelectedVoxels: () => {},
    updateBlockColor: () => {},
    setBlockColors: () => {},
    restoreObject: () => {},
  };

  return {
    reducers,
    projectId: "test-project",
    dimensions,
    projectManager: {
      applyOptimisticRectEdit: () => {},
      getBlockAtPosition: () => 1,
      chunkManager: {
        updatePreview: () => {},
        clearPreview: () => {},
        previewBuffer,
        getDimensions: () => dimensions,
        getObject: () => undefined,
        getObjectContentBounds: () => null,
      },
    } as unknown as ProjectManager,
    previewBuffer,
    selectedBlock: 1,
    selectedObject: 0,
    setSelectedBlockInParent: () => {},
    mode: attachMode,
    camera,
    scene: new THREE.Scene(),
  };
}

function getVoxel(buffer: Uint8Array, x: number, y: number, z: number, dims: Vector3): number {
  return buffer[x * dims.y * dims.z + y * dims.z + z];
}

describe("wrapCoord", () => {
  it("should return the value unchanged when within bounds", () => {
    expect(wrapCoord(0, 10)).toBe(0);
    expect(wrapCoord(5, 10)).toBe(5);
    expect(wrapCoord(9, 10)).toBe(9);
  });

  it("should wrap positive overflow", () => {
    expect(wrapCoord(10, 10)).toBe(0);
    expect(wrapCoord(11, 10)).toBe(1);
    expect(wrapCoord(15, 10)).toBe(5);
  });

  it("should wrap negative values", () => {
    expect(wrapCoord(-1, 10)).toBe(9);
    expect(wrapCoord(-2, 10)).toBe(8);
    expect(wrapCoord(-10, 10)).toBe(0);
  });
});

describe("Brush Tool Wrapping", () => {
  const dimensions: Vector3 = { x: 10, y: 10, z: 10 };

  it("should wrap brush at the max X boundary", () => {
    const context = createTestContext(dimensions);
    const tool = new BrushTool();
    tool.setOption("Brush Shape", "Cube");
    tool.setOption("Size", "3");

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(9, 5, 5),
      mousePosition: new THREE.Vector2(0, 0),
    });

    expect(getVoxel(context.previewBuffer, 8, 5, 5, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 9, 5, 5, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 0, 5, 5, dimensions)).not.toBe(0);
  });

  it("should wrap brush at the min X boundary", () => {
    const context = createTestContext(dimensions);
    const tool = new BrushTool();
    tool.setOption("Brush Shape", "Cube");
    tool.setOption("Size", "3");

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(0, 5, 5),
      mousePosition: new THREE.Vector2(0, 0),
    });

    expect(getVoxel(context.previewBuffer, 9, 5, 5, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 0, 5, 5, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 1, 5, 5, dimensions)).not.toBe(0);
  });

  it("should wrap brush at the max Z boundary", () => {
    const context = createTestContext(dimensions);
    const tool = new BrushTool();
    tool.setOption("Brush Shape", "Cube");
    tool.setOption("Size", "3");

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(5, 5, 9),
      mousePosition: new THREE.Vector2(0, 0),
    });

    expect(getVoxel(context.previewBuffer, 5, 5, 8, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 5, 5, 9, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 5, 5, 0, dimensions)).not.toBe(0);
  });

  it("should not wrap when brush is fully within bounds", () => {
    const context = createTestContext(dimensions);
    const tool = new BrushTool();
    tool.setOption("Brush Shape", "Cube");
    tool.setOption("Size", "3");

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(5, 5, 5),
      mousePosition: new THREE.Vector2(0, 0),
    });

    expect(getVoxel(context.previewBuffer, 4, 5, 5, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 5, 5, 5, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 6, 5, 5, dimensions)).not.toBe(0);

    expect(getVoxel(context.previewBuffer, 0, 5, 5, dimensions)).toBe(0);
    expect(getVoxel(context.previewBuffer, 9, 5, 5, dimensions)).toBe(0);
  });

  it("should wrap on multiple axes simultaneously", () => {
    const context = createTestContext(dimensions);
    const tool = new BrushTool();
    tool.setOption("Brush Shape", "Cube");
    tool.setOption("Size", "3");

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(0, 0, 0),
      mousePosition: new THREE.Vector2(0, 0),
    });

    expect(getVoxel(context.previewBuffer, 9, 9, 9, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 0, 0, 0, dimensions)).not.toBe(0);
    expect(getVoxel(context.previewBuffer, 1, 1, 1, dimensions)).not.toBe(0);
  });
});
