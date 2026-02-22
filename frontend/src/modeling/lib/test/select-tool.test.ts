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

  beforeEach(() => {
    voxelSelection = null;
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
        voxelSelection: null,
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

  it("should select voxels within a screen-space circle", () => {
    const tool = new SelectTool();
    tool.setOption("Select Shape", "Circle");

    const center = new THREE.Vector3(5.5, 5.5, 0.5);
    center.project(mockContext.camera);
    const edge = new THREE.Vector3(7.5, 5.5, 0.5);
    edge.project(mockContext.camera);
    const startX = 2 * center.x - edge.x;
    const startY = 2 * center.y - edge.y;

    tool.onMouseDown(mockContext, {
      gridPosition: new THREE.Vector3(3, 5, 0),
      mousePosition: new THREE.Vector2(startX, startY),
    });

    tool.onMouseUp(mockContext, {
      startGridPosition: new THREE.Vector3(3, 5, 0),
      currentGridPosition: new THREE.Vector3(7, 5, 0),
      startMousePosition: new THREE.Vector2(startX, startY),
      currentMousePosition: new THREE.Vector2(edge.x, edge.y),
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
});
