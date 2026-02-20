import { describe, it, expect } from "vitest";
import { wrapCoord } from "../tools/tool-utils";
import { MoveSelectionTool } from "../tools/move-selection-tool";
import type { ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode } from "@/state/types";
import type { Reducers } from "@/state/store";
import type { ProjectManager } from "../project-manager";
import * as THREE from "three";

function createMoveTestContext(dimensions: Vector3): {
  context: ToolContext;
  committedOffsets: Vector3[];
} {
  const attachMode: BlockModificationMode = { tag: "Attach" };
  const previewBuffer = new Uint8Array(dimensions.x * dimensions.y * dimensions.z);
  const committedOffsets: Vector3[] = [];

  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 30);
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
    commitSelectionMove: (_projectId: string, offset: Vector3) => {
      committedOffsets.push(offset);
    },
    selectAllVoxels: () => {},
    deleteSelectedVoxels: () => {},
    updateBlockColor: () => {},
    setBlockColors: () => {},
    restoreObject: () => {},
  };

  const context: ToolContext = {
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
        getObject: () => ({
          selection: null,
        }),
        getObjectContentBounds: () => ({
          min: { x: 3, y: 3, z: 3 },
          max: { x: 6, y: 6, z: 6 },
        }),
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

  return { context, committedOffsets };
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

describe("MoveSelectionTool wrapping", () => {
  const dimensions: Vector3 = { x: 10, y: 10, z: 10 };

  it("should wrap offset during drag when it exceeds dimensions", () => {
    const { context } = createMoveTestContext(dimensions);
    const tool = new MoveSelectionTool();
    tool.onActivate!(context);

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(5, 5, 5),
      mousePosition: new THREE.Vector2(0, 0),
    });

    tool.onDrag(context, {
      startGridPosition: new THREE.Vector3(5, 5, 5),
      currentGridPosition: new THREE.Vector3(5, 5, 5),
      startMousePosition: new THREE.Vector2(0, 0),
      currentMousePosition: new THREE.Vector2(5, 0),
    });

    const lastOffset = (tool as unknown as { lastOffset: THREE.Vector3 }).lastOffset;
    expect(lastOffset.x).toBeGreaterThanOrEqual(0);
    expect(lastOffset.x).toBeLessThan(dimensions.x);
    expect(lastOffset.y).toBeGreaterThanOrEqual(0);
    expect(lastOffset.y).toBeLessThan(dimensions.y);
  });

  it("should commit wrapped offset", () => {
    const { context, committedOffsets } = createMoveTestContext(dimensions);
    const tool = new MoveSelectionTool();
    tool.onActivate!(context);

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(5, 5, 5),
      mousePosition: new THREE.Vector2(0, 0),
    });

    tool.onDrag(context, {
      startGridPosition: new THREE.Vector3(5, 5, 5),
      currentGridPosition: new THREE.Vector3(5, 5, 5),
      startMousePosition: new THREE.Vector2(0, 0),
      currentMousePosition: new THREE.Vector2(0.3, 0),
    });

    const lastOffset = (tool as unknown as { lastOffset: THREE.Vector3 }).lastOffset;
    expect(lastOffset.length()).toBeGreaterThan(0);

    tool.onMouseUp(context, {
      startGridPosition: new THREE.Vector3(5, 5, 5),
      currentGridPosition: new THREE.Vector3(5, 5, 5),
      startMousePosition: new THREE.Vector2(0, 0),
      currentMousePosition: new THREE.Vector2(0.3, 0),
    });

    expect(committedOffsets).toHaveLength(1);
    const offset = committedOffsets[0];
    expect(offset.x).toBeGreaterThanOrEqual(0);
    expect(offset.x).toBeLessThan(dimensions.x);
    expect(offset.y).toBeGreaterThanOrEqual(0);
    expect(offset.y).toBeLessThan(dimensions.y);
    expect(offset.z).toBeGreaterThanOrEqual(0);
    expect(offset.z).toBeLessThan(dimensions.z);
  });

  it("should not alter small offsets within bounds", () => {
    const { context } = createMoveTestContext(dimensions);
    const tool = new MoveSelectionTool();
    tool.onActivate!(context);

    tool.onMouseDown(context, {
      gridPosition: new THREE.Vector3(5, 5, 5),
      mousePosition: new THREE.Vector2(0, 0),
    });

    tool.onDrag(context, {
      startGridPosition: new THREE.Vector3(5, 5, 5),
      currentGridPosition: new THREE.Vector3(5, 5, 5),
      startMousePosition: new THREE.Vector2(0, 0),
      currentMousePosition: new THREE.Vector2(0.05, 0),
    });

    const lastOffset = (tool as unknown as { lastOffset: THREE.Vector3 }).lastOffset;
    expect(lastOffset.x).toBeGreaterThanOrEqual(0);
    expect(lastOffset.x).toBeLessThan(dimensions.x);
  });
});
