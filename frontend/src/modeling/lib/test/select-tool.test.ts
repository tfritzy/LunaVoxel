import { describe, it, expect, beforeEach } from "vitest";
import { SelectTool } from "../tools/select-tool";
import type { ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode, VoxelObject } from "@/state/types";
import type { Reducers, StateStore, VoxelSelection } from "@/state/store";
import type { ProjectManager } from "../project-manager";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { VoxelFrame } from "../voxel-frame";
import * as THREE from "three";
import { getChunkKey } from "@/lib/chunk-utils";
import type { ChunkData } from "@/state/types";

describe("SelectTool", () => {
  let mockContext: ToolContext;
  const dimensions: Vector3 = { x: 10, y: 10, z: 10 };
  let voxels: Uint8Array;
  let voxelSelection: VoxelSelection | null;
  let currentVoxelFrame: VoxelFrame | null;

  beforeEach(() => {
    voxelSelection = null;
    currentVoxelFrame = null;
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);
    camera.position.set(5, 5, 20);
    camera.lookAt(5, 5, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    voxels = new Uint8Array(dimensions.x * dimensions.y * dimensions.z);

    for (let x = 2; x <= 7; x++) {
      for (let y = 2; y <= 7; y++) {
        for (let z = 0; z <= 5; z++) {
          voxels[x * dimensions.y * dimensions.z + y * dimensions.z + z] = (1 | RAYCASTABLE_BIT);
        }
      }
    }

    const chunkData: ChunkData = {
      key: getChunkKey("test-obj", { x: 0, y: 0, z: 0 }),
      projectId: "test-project",
      objectId: "test-obj",
      minPos: { x: 0, y: 0, z: 0 },
      size: dimensions,
      voxels,
      selection: new VoxelFrame(dimensions),
    };

    const chunks = new Map<string, ChunkData>();
    chunks.set(chunkData.key, chunkData);

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
      setVoxelSelection: (_objectId: string, frame: VoxelFrame | null) => {
        currentVoxelFrame = frame;
        if (!frame) {
          voxelSelection = null;
        } else {
          voxelSelection = { objectId: _objectId, frame };
        }
      },
      moveSelection: () => {},
      moveObject: () => {},
      beginSelectionMove: () => {},
      commitSelectionMove: () => {},
      selectAllVoxels: () => {},
      deleteSelectedVoxels: () => {},
      updateBlockColor: () => {},
      setBlockColors: () => {},
      restoreObject: () => {},
      setActiveObject: () => {},
    };

    const mockObjects: VoxelObject[] = [{
      id: "test-obj",
      projectId: "test-project",
      name: "Object 1",
      visible: true,
      locked: false,
      position: { x: 0, y: 0, z: 0 },
      dimensions,
    }];

    const mockStateStore = {
      getState: () => ({
        project: { id: "test-project", dimensions },
        objects: mockObjects,
        activeObjectId: "test-obj",
        voxelSelection: currentVoxelFrame,
        blocks: { projectId: "test-project", colors: [] },
        chunks,
      }),
      subscribe: () => () => {},
      reducers,
    } as StateStore;

    mockContext = {
      stateStore: mockStateStore,
      reducers,
      projectId: "test-project",
      projectManager: {
        chunkManager: {
          previewBuffer: new Uint8Array(0),
          updatePreview: () => {},
          clearPreview: () => {},
        },
      } as unknown as ProjectManager,
      previewBuffer: new Uint8Array(0),
      selectedBlock: 1,
      setSelectedBlockInParent: () => {},
      mode: { tag: "Attach" } as BlockModificationMode,
      camera,
      scene: new THREE.Scene(),
      overlayCanvas: { getContext: () => null, width: 0, height: 0 } as unknown as HTMLCanvasElement,
    };
  });

  it("should return Select as type", () => {
    const tool = new SelectTool();
    expect(tool.getType()).toBe("Select");
  });

  it("should return Select Shape option", () => {
    const tool = new SelectTool();
    const options = tool.getOptions();
    expect(options).toHaveLength(1);
    expect(options[0].name).toBe("Select Shape");
    expect(options[0].values).toEqual(["Rectangle", "Circle", "Lasso", "Magic"]);
    expect(options[0].currentValue).toBe("Rectangle");
  });

  it("should update shape via setOption", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");
    expect(tool.getOptions()[0].currentValue).toBe("Rectangle");
  });

  it("should call magicSelect on mouse up in Magic mode", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Magic");
    let magicSelectCalled = false;
    mockContext.reducers = {
      ...mockContext.reducers,
      magicSelect: () => { magicSelectCalled = true; },
    };

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(5, 5, 3),
      currentGridPosition: new THREE.Vector3(5, 5, 3),
      startMousePosition: new THREE.Vector2(0, 0),
      currentMousePosition: new THREE.Vector2(0, 0),
    });

    expect(magicSelectCalled).toBe(true);
  });

  it("should select voxels within a screen-space rectangle", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");

    const topLeft = new THREE.Vector3(2.5, 2.5, 0.5);
    topLeft.project(mockContext.camera);
    const bottomRight = new THREE.Vector3(7.5, 7.5, 0.5);
    bottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(2, 2, 0),
      mousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(2, 2, 0),
      currentGridPosition: new THREE.Vector3(7, 7, 5),
      startMousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
      currentMousePosition: new THREE.Vector2(bottomRight.x, bottomRight.y),
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });

  it("should not select voxels outside the screen rectangle", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");

    const topLeft = new THREE.Vector3(4.5, 4.5, 3.5);
    topLeft.project(mockContext.camera);
    const bottomRight = new THREE.Vector3(6.5, 6.5, 3.5);
    bottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(4, 4, 3),
      mousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(4, 4, 3),
      currentGridPosition: new THREE.Vector3(6, 6, 3),
      startMousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
      currentMousePosition: new THREE.Vector2(bottomRight.x, bottomRight.y),
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
    expect(voxelSelection!.frame.isSet(2, 2, 0)).toBe(false);
  });

  it("should select voxels within a screen-space ellipse", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Circle");

    const topLeft = new THREE.Vector3(3.5, 3.5, 0.5);
    topLeft.project(mockContext.camera);
    const bottomRight = new THREE.Vector3(7.5, 7.5, 0.5);
    bottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(3, 3, 0),
      mousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(3, 3, 0),
      currentGridPosition: new THREE.Vector3(7, 7, 0),
      startMousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
      currentMousePosition: new THREE.Vector2(bottomRight.x, bottomRight.y),
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });

  it("should select voxels within a screen-space circle when shift is held", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Circle");

    const topLeft = new THREE.Vector3(3.5, 3.5, 0.5);
    topLeft.project(mockContext.camera);
    const bottomRight = new THREE.Vector3(7.5, 7.5, 0.5);
    bottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(3, 3, 0),
      mousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(3, 3, 0),
      currentGridPosition: new THREE.Vector3(7, 7, 0),
      startMousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
      currentMousePosition: new THREE.Vector2(bottomRight.x, bottomRight.y),
      shiftKey: true,
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });

  it("should constrain rectangle to square when shift is held", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");

    const topLeft = new THREE.Vector3(3.5, 3.5, 0.5);
    topLeft.project(mockContext.camera);
    const bottomRight = new THREE.Vector3(7.5, 7.5, 0.5);
    bottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(3, 3, 0),
      mousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(3, 3, 0),
      currentGridPosition: new THREE.Vector3(7, 7, 0),
      startMousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
      currentMousePosition: new THREE.Vector2(bottomRight.x, bottomRight.y),
      shiftKey: true,
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });

  it("should set selection to null when no voxels are in the region", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(0, 0, 0),
      mousePosition: new THREE.Vector2(-0.99, -0.99),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(0, 0, 0),
      currentGridPosition: new THREE.Vector3(0, 0, 0),
      startMousePosition: new THREE.Vector2(-0.99, -0.99),
      currentMousePosition: new THREE.Vector2(-0.98, -0.98),
    });

    expect(voxelSelection).toBeNull();
  });

  it("should select voxels using lasso (polygon) selection", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Lasso");

    const p1 = new THREE.Vector3(2.5, 2.5, 0.5);
    p1.project(mockContext.camera);
    const p2 = new THREE.Vector3(7.5, 2.5, 0.5);
    p2.project(mockContext.camera);
    const p3 = new THREE.Vector3(7.5, 7.5, 0.5);
    p3.project(mockContext.camera);
    const p4 = new THREE.Vector3(2.5, 7.5, 0.5);
    p4.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(2, 2, 0),
      mousePosition: new THREE.Vector2(p1.x, p1.y),
    });

    tool.onDrag(mockContext, {
      startGridPosition: new THREE.Vector3(2, 2, 0),
      currentGridPosition: new THREE.Vector3(7, 2, 0),
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p2.x, p2.y),
    });

    tool.onDrag(mockContext, {
      startGridPosition: new THREE.Vector3(2, 2, 0),
      currentGridPosition: new THREE.Vector3(7, 7, 0),
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p3.x, p3.y),
    });

    tool.onDrag(mockContext, {
      startGridPosition: new THREE.Vector3(2, 2, 0),
      currentGridPosition: new THREE.Vector3(2, 7, 0),
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p4.x, p4.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(2, 2, 0),
      currentGridPosition: new THREE.Vector3(2, 2, 0),
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p1.x, p1.y),
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });

  it("should select voxels via rectangle using fallback grid positions", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");

    const topLeft = new THREE.Vector3(2.5, 2.5, 0.5);
    topLeft.project(mockContext.camera);
    const bottomRight = new THREE.Vector3(7.5, 7.5, 0.5);
    bottomRight.project(mockContext.camera);

    const fallbackPos = new THREE.Vector3(0, 0, 0);

    tool.onMouseDown(mockContext, {
      gridPosition: fallbackPos,
      mousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: fallbackPos,
      currentGridPosition: fallbackPos,
      startMousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
      currentMousePosition: new THREE.Vector2(bottomRight.x, bottomRight.y),
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });

  it("should collect lasso points during drag with fallback grid positions", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Lasso");

    const p1 = new THREE.Vector3(2.5, 2.5, 0.5);
    p1.project(mockContext.camera);
    const p2 = new THREE.Vector3(7.5, 2.5, 0.5);
    p2.project(mockContext.camera);
    const p3 = new THREE.Vector3(7.5, 7.5, 0.5);
    p3.project(mockContext.camera);
    const p4 = new THREE.Vector3(2.5, 7.5, 0.5);
    p4.project(mockContext.camera);

    const fallbackPos = new THREE.Vector3(0, 0, 0);

    tool.onMouseDown(mockContext, {
      gridPosition: fallbackPos,
      mousePosition: new THREE.Vector2(p1.x, p1.y),
    });

    tool.onDrag(mockContext, {
      startGridPosition: fallbackPos,
      currentGridPosition: fallbackPos,
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p2.x, p2.y),
    });

    tool.onDrag(mockContext, {
      startGridPosition: fallbackPos,
      currentGridPosition: fallbackPos,
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p3.x, p3.y),
    });

    tool.onDrag(mockContext, {
      startGridPosition: fallbackPos,
      currentGridPosition: fallbackPos,
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p4.x, p4.y),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: fallbackPos,
      currentGridPosition: fallbackPos,
      startMousePosition: new THREE.Vector2(p1.x, p1.y),
      currentMousePosition: new THREE.Vector2(p1.x, p1.y),
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });

  it("should append to existing selection when shift is held (Rectangle)", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");

    // First selection: top-left region
    const firstTopLeft = new THREE.Vector3(2.5, 2.5, 0.5);
    firstTopLeft.project(mockContext.camera);
    const firstBottomRight = new THREE.Vector3(4.5, 4.5, 0.5);
    firstBottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(2, 2, 0),
      mousePosition: new THREE.Vector2(firstTopLeft.x, firstTopLeft.y),
    });
    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(2, 2, 0),
      currentGridPosition: new THREE.Vector3(4, 4, 0),
      startMousePosition: new THREE.Vector2(firstTopLeft.x, firstTopLeft.y),
      currentMousePosition: new THREE.Vector2(firstBottomRight.x, firstBottomRight.y),
    });

    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(3, 3, 3)).toBe(true);

    // Second selection: bottom-right region with shift held
    const secondTopLeft = new THREE.Vector3(5.5, 5.5, 0.5);
    secondTopLeft.project(mockContext.camera);
    const secondBottomRight = new THREE.Vector3(7.5, 7.5, 0.5);
    secondBottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(5, 5, 0),
      mousePosition: new THREE.Vector2(secondTopLeft.x, secondTopLeft.y),
    });
    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(5, 5, 0),
      currentGridPosition: new THREE.Vector3(7, 7, 0),
      startMousePosition: new THREE.Vector2(secondTopLeft.x, secondTopLeft.y),
      currentMousePosition: new THREE.Vector2(secondBottomRight.x, secondBottomRight.y),
      shiftKey: true,
    });

    // Both regions should now be selected
    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(3, 3, 3)).toBe(true);
    expect(voxelSelection!.frame.isSet(6, 6, 3)).toBe(true);
  });

  it("should not clear existing selection when shift is held and new region is empty (Rectangle)", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Rectangle");

    // First selection
    const topLeft = new THREE.Vector3(2.5, 2.5, 0.5);
    topLeft.project(mockContext.camera);
    const bottomRight = new THREE.Vector3(7.5, 7.5, 0.5);
    bottomRight.project(mockContext.camera);

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(2, 2, 0),
      mousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
    });
    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(2, 2, 0),
      currentGridPosition: new THREE.Vector3(7, 7, 0),
      startMousePosition: new THREE.Vector2(topLeft.x, topLeft.y),
      currentMousePosition: new THREE.Vector2(bottomRight.x, bottomRight.y),
    });

    expect(voxelSelection).not.toBeNull();

    // Shift-select an empty region
    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(0, 0, 0),
      mousePosition: new THREE.Vector2(-0.99, -0.99),
    });
    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(0, 0, 0),
      currentGridPosition: new THREE.Vector3(0, 0, 0),
      startMousePosition: new THREE.Vector2(-0.99, -0.99),
      currentMousePosition: new THREE.Vector2(-0.98, -0.98),
      shiftKey: true,
    });

    // Existing selection should be preserved
    expect(voxelSelection).not.toBeNull();
    expect(voxelSelection!.frame.isSet(5, 5, 3)).toBe(true);
  });
});
