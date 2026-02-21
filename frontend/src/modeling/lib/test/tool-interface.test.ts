import { describe, it, expect, beforeEach } from "vitest";
import { RectTool } from "../tools/rect-tool";
import { BlockPickerTool } from "../tools/block-picker-tool";
import { MagicSelectTool } from "../tools/magic-select-tool";
import { MoveSelectionTool } from "../tools/move-selection-tool";
import { BrushTool } from "../tools/brush-tool";
import type { Tool, ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode } from "@/state/types";
import type { Reducers } from "@/state/store";
import type { ProjectManager } from "../project-manager";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import * as THREE from "three";
import { VoxelFrame } from "../voxel-frame";

describe("Tool Interface", () => {
  let mockContext: ToolContext;
  const dimensions: Vector3 = { x: 10, y: 10, z: 10 };
  const attachMode: BlockModificationMode = { tag: "Attach" };
  const eraseMode: BlockModificationMode = { tag: "Erase" };
  const paintMode: BlockModificationMode = { tag: "Paint" };

  beforeEach(() => {
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
      beginSelectionMove: () => {},
      commitSelectionMove: () => {},
      selectAllVoxels: () => {},
      deleteSelectedVoxels: () => {},
      updateBlockColor: () => {},
      setBlockColors: () => {},
      restoreObject: () => {},
    };

    const previewBuffer = new Uint8Array(dimensions.x * dimensions.y * dimensions.z);

    mockContext = {
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
  });

  describe("Tool Factory", () => {
    it("should create RectTool", () => {
      const rectTool = new RectTool();
      
      expect(rectTool.getType()).toEqual("Rect");
    });

    it("should create BlockPicker tool", () => {
      const tool = new BlockPickerTool();
      expect(tool.getType()).toEqual("BlockPicker");
    });

    it("should create MagicSelect tool", () => {
      const tool = new MagicSelectTool();
      expect(tool.getType()).toEqual("MagicSelect");
    });

    it("should create MoveSelection tool", () => {
      const tool = new MoveSelectionTool();
      expect(tool.getType()).toEqual("MoveSelection");
    });

    it("should create BrushTool", () => {
      const tool = new BrushTool();
      expect(tool.getType()).toEqual("Brush");
    });
  });

  describe("Tool Options", () => {
    it("should return fill shape and direction options for RectTool", () => {
      const tool = new RectTool();
      const options = tool.getOptions();
      
      expect(options).toHaveLength(3);
      expect(options[0].name).toBe("Fill Shape");
      expect(options[0].values).toEqual(["Rect", "Sphere", "Cylinder", "Triangle", "Diamond", "Cone", "Pyramid", "Hexagon"]);
      expect(options[0].currentValue).toBe("Rect");
      expect(options[1].name).toBe("Direction");
      expect(options[1].values).toEqual(["+x", "-x", "+y", "-y", "+z", "-z"]);
      expect(options[1].currentValue).toBe("+y");
      expect(options[2].name).toBe("Adjust Before Apply");
      expect(options[2].values).toEqual(["true", "false"]);
      expect(options[2].currentValue).toBe("true");
      expect(options[2].type).toBe("checkbox");
    });

    it("should update fill shape option on RectTool", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Sphere");
      
      const options = tool.getOptions();
      expect(options[0].currentValue).toBe("Sphere");
    });

    it("should update direction option on RectTool", () => {
      const tool = new RectTool();
      tool.setOption("Direction", "-y");
      
      const options = tool.getOptions();
      expect(options[1].currentValue).toBe("-y");
    });

    it("should update adjust before apply option on RectTool", () => {
      const tool = new RectTool();
      tool.setOption("Adjust Before Apply", "false");

      const options = tool.getOptions();
      expect(options[2].currentValue).toBe("false");
    });

    it("should return empty options for BlockPicker", () => {
      const tool = new BlockPickerTool();
      expect(tool.getOptions()).toHaveLength(0);
    });

    it("should return empty options for MagicSelect", () => {
      const tool = new MagicSelectTool();
      expect(tool.getOptions()).toHaveLength(0);
    });

    it("should return empty options for MoveSelection", () => {
      const tool = new MoveSelectionTool();
      expect(tool.getOptions()).toHaveLength(0);
    });
  });

  describe("RectTool with modes", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = new RectTool();
    });

    it("should calculate grid position above hit voxel in Attach mode", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, attachMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(3);
      expect(gridPos.z).toBe(3);
    });

    it("should calculate grid position at hit voxel in Erase mode", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, eraseMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });

    it("should calculate grid position at hit voxel in Paint mode", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, paintMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });

    it("should show preview on drag", () => {
      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(3, 4, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5)
      });
      
      expect(mockContext.previewBuffer[1 * dimensions.y * dimensions.z + 2 * dimensions.z + 3]).toBeGreaterThan(0);
    });

    it("should show bounds helper during drag preview", () => {
      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(3, 4, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      const boundsHelper = mockContext.scene.children.find(
        (child): child is THREE.Box3Helper => child instanceof THREE.Box3Helper
      );

      expect(boundsHelper).toBeDefined();
      expect(boundsHelper!.box.min.toArray()).toEqual([1, 2, 3]);
      expect(boundsHelper!.box.max.toArray()).toEqual([4, 5, 6]);
    });

    it("should clamp rect bounds when dragging outside world bounds", () => {
      const tool = new RectTool();
      tool.setOption("Adjust Before Apply", "false");

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(5, 0, 5),
        currentGridPosition: new THREE.Vector3(15, 0, 15),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(mockContext.previewBuffer[5 * dimensions.y * dimensions.z + 0 * dimensions.z + 5]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[9 * dimensions.y * dimensions.z + 0 * dimensions.z + 9]).toBeGreaterThan(0);
    });

    it("should clamp rect bounds when both start and end are outside world bounds", () => {
      const tool = new RectTool();
      tool.setOption("Adjust Before Apply", "false");

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(-5, 0, -5),
        currentGridPosition: new THREE.Vector3(15, 0, 15),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[9 * dimensions.y * dimensions.z + 0 * dimensions.z + 9]).toBeGreaterThan(0);
    });
  });

  describe("RectTool Fill Shapes", () => {
    it("should fill all blocks with Rect shape", () => {
      const tool = new RectTool();
      
      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(2, 2, 2),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[1 * dimensions.y * dimensions.z + 1 * dimensions.z + 1]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBeGreaterThan(0);
    });

    it("should create sphere shape when fill shape is Sphere", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Sphere");

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(2, 2, 2),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(mockContext.previewBuffer[1 * dimensions.y * dimensions.z + 1 * dimensions.z + 1]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBe(0);
    });

    it("should enter pending state on mouse up with Sphere fill shape", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Sphere");
      
      let called = false;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: () => {
          called = true;
        },
      };

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(3, 4, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(called).toBe(false);
      expect(tool.hasPendingOperation()).toBe(true);

      tool.commitPendingOperation(mockContext);
      expect(called).toBe(true);
      expect(tool.hasPendingOperation()).toBe(false);
    });

    it("should create cylinder shape when fill shape is Cylinder", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Cylinder");

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 4, 4),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 2 * dimensions.z + 0]).toBe(0);
    });

    it("should create diamond shape when fill shape is Diamond", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Diamond");

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 4, 4),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBe(0);
    });
  });

  describe("RectTool Pending Operation", () => {
    let tool: RectTool;

    beforeEach(() => {
      tool = new RectTool();
    });

    it("should have no pending operation initially", () => {
      expect(tool.hasPendingOperation()).toBe(false);
      expect(tool.getPendingBounds()).toBeNull();
    });

    it("should enter pending state after mouse up", () => {
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(tool.hasPendingOperation()).toBe(true);
      const bounds = tool.getPendingBounds();
      expect(bounds).not.toBeNull();
      expect(bounds!.minX).toBe(1);
      expect(bounds!.maxX).toBe(3);
      expect(bounds!.minY).toBe(1);
      expect(bounds!.maxY).toBe(3);
      expect(bounds!.minZ).toBe(1);
      expect(bounds!.maxZ).toBe(3);
    });

    it("should keep preview visible after mouse up", () => {
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(mockContext.previewBuffer[1 * dimensions.y * dimensions.z + 1 * dimensions.z + 1]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBeGreaterThan(0);
    });

    it("should apply immediately on mouse up when adjust before apply is disabled", () => {
      let applied = false;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: () => {
          applied = true;
        },
      };

      tool.setOption("Adjust Before Apply", "false");
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(applied).toBe(true);
      expect(tool.hasPendingOperation()).toBe(false);
    });

    it("should commit pending operation with applyFrame", () => {
      let applied = false;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: () => {
          applied = true;
        },
      };

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(applied).toBe(false);

      tool.commitPendingOperation(mockContext);
      expect(applied).toBe(true);
      expect(tool.hasPendingOperation()).toBe(false);
    });

    it("should clear preview in chunk manager after commit", () => {
      let previewCleared = false;
      mockContext.projectManager = {
        ...mockContext.projectManager,
        chunkManager: {
          ...mockContext.projectManager.chunkManager,
          clearPreview: () => {
            previewCleared = true;
          },
        },
      } as unknown as ProjectManager;

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      previewCleared = false;
      tool.commitPendingOperation(mockContext);
      expect(previewCleared).toBe(true);
      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBe(0);
    });

    it("should cancel pending operation and clear preview", () => {
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      tool.cancelPendingOperation(mockContext);
      expect(tool.hasPendingOperation()).toBe(false);
      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBe(0);
    });

    it("should recalculate shape when resizing pending bounds", () => {
      tool.setOption("Fill Shape", "Sphere");

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 4, 4),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      const originalCenter = mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2];
      expect(originalCenter).toBeGreaterThan(0);

      tool.resizePendingBounds(mockContext, {
        minX: 0, maxX: 6,
        minY: 0, maxY: 6,
        minZ: 0, maxZ: 6,
      });

      expect(tool.getPendingBounds()!.maxX).toBe(6);
      expect(mockContext.previewBuffer[3 * dimensions.y * dimensions.z + 3 * dimensions.z + 3]).toBeGreaterThan(0);
    });

    it("should clamp resized bounds to dimensions", () => {
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      tool.resizePendingBounds(mockContext, {
        minX: -5, maxX: 20,
        minY: -5, maxY: 20,
        minZ: -5, maxZ: 20,
      });

      const bounds = tool.getPendingBounds()!;
      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(9);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxY).toBe(9);
    });

    it("should update pending shape when fill shape is changed during editing phase", () => {
      tool.setOption("Fill Shape", "Sphere");

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 4, 4),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      const previewCorner = mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0];
      const previewCenter = mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2];
      expect(previewCorner).toBe(0);
      expect(previewCenter).toBeGreaterThan(0);

      tool.setOption("Fill Shape", "Rect");
      tool.updatePending!(mockContext);

      let committedFrame: VoxelFrame | null = null;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: (_mode, _block, frame) => {
          committedFrame = frame.clone();
        },
      };

      tool.commitPendingOperation(mockContext);

      expect(committedFrame).not.toBeNull();
      expect(committedFrame!.get(0, 0, 0)).toBeGreaterThan(0);
      expect(committedFrame!.get(2, 2, 2)).toBeGreaterThan(0);
    });

    it("should update pending color when selected block is changed during editing phase", () => {
      mockContext.selectedBlock = 5;

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      const previewValue = mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2];
      expect(previewValue).toBe(5);

      mockContext.selectedBlock = 9;
      tool.updatePending!(mockContext);

      const updatedPreviewValue = mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2];
      expect(updatedPreviewValue).toBe(9);

      let committedBlock: number | null = null;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: (_mode, block) => {
          committedBlock = block;
        },
      };

      tool.commitPendingOperation(mockContext);

      expect(committedBlock).toBe(9);
    });

    it("should use updated shape when resizing pending bounds after shape change", () => {
      tool.setOption("Fill Shape", "Sphere");

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 4, 4),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      tool.setOption("Fill Shape", "Rect");

      tool.resizePendingBounds(mockContext, {
        minX: 0, maxX: 6,
        minY: 0, maxY: 6,
        minZ: 0, maxZ: 6,
      });

      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[3 * dimensions.y * dimensions.z + 3 * dimensions.z + 3]).toBeGreaterThan(0);
    });
  });

  describe("RectTool Shift Snap", () => {
    let tool: RectTool;

    beforeEach(() => {
      tool = new RectTool();
    });

    it("should snap drag bounds to equal dimensions when shiftKey is held", () => {
      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 2, 1),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
        shiftKey: true,
      });

      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[4 * dimensions.y * dimensions.z + 4 * dimensions.z + 4]).toBeGreaterThan(0);
    });

    it("should not snap bounds when shiftKey is not held", () => {
      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 2, 1),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
        shiftKey: false,
      });

      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[4 * dimensions.y * dimensions.z + 2 * dimensions.z + 1]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[4 * dimensions.y * dimensions.z + 4 * dimensions.z + 4]).toBe(0);
    });

    it("should snap mouseUp bounds to equal dimensions when shiftKey is held", () => {
      tool.setOption("Adjust Before Apply", "true");
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(4, 2, 1),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
        shiftKey: true,
      });

      const bounds = tool.getPendingBounds()!;
      const sizeX = bounds.maxX - bounds.minX;
      const sizeY = bounds.maxY - bounds.minY;
      const sizeZ = bounds.maxZ - bounds.minZ;
      expect(sizeX).toBe(sizeY);
      expect(sizeY).toBe(sizeZ);
    });

    it("should expand toward the end position when snapping", () => {
      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(5, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
        shiftKey: true,
      });

      expect(mockContext.previewBuffer[0 * dimensions.y * dimensions.z + 0 * dimensions.z + 0]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[5 * dimensions.y * dimensions.z + 5 * dimensions.z + 5]).toBeGreaterThan(0);
    });
  });

  describe("BlockPicker Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = new BlockPickerTool();
    });

    it("should calculate grid position at hit voxel", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, attachMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });

    it("should pick block on mouse up", () => {
      const startPos = new THREE.Vector3(1, 2, 3);
      const endPos = new THREE.Vector3(1, 2, 3);
      let selectedBlock = 0;

      mockContext.setSelectedBlockInParent = (block: number) => {
        selectedBlock = block;
      };
      mockContext.projectManager.getBlockAtPosition = () => 5;

      tool.onMouseUp(mockContext, {
        startGridPosition: startPos,
        currentGridPosition: endPos,
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(selectedBlock).toBe(5);
    });

    it("should not pick empty block values on mouse up", () => {
      const startPos = new THREE.Vector3(1, 2, 3);
      const endPos = new THREE.Vector3(1, 2, 3);
      let selectedBlock = 0;

      mockContext.setSelectedBlockInParent = (block: number) => {
        selectedBlock = block;
      };
      mockContext.projectManager.getBlockAtPosition = () => RAYCASTABLE_BIT;

      tool.onMouseUp(mockContext, {
        startGridPosition: startPos,
        currentGridPosition: endPos,
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(selectedBlock).toBe(0);
    });

    it("should pick masked block type on mouse up", () => {
      const startPos = new THREE.Vector3(1, 2, 3);
      const endPos = new THREE.Vector3(1, 2, 3);
      let selectedBlock = 0;

      mockContext.setSelectedBlockInParent = (block: number) => {
        selectedBlock = block;
      };
      mockContext.projectManager.getBlockAtPosition = () => RAYCASTABLE_BIT | 5;

      tool.onMouseUp(mockContext, {
        startGridPosition: startPos,
        currentGridPosition: endPos,
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(selectedBlock).toBe(5);
    });
  });

  describe("MagicSelect Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = new MagicSelectTool();
    });

    it("should calculate grid position at hit voxel", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, attachMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });

    it("should execute magic select on mouse up", () => {
      let magicSelectCalled = false;
      mockContext.reducers = {
        ...mockContext.reducers,
        magicSelect: () => {
          magicSelectCalled = true;
        },
      };

      const startPos = new THREE.Vector3(1, 2, 3);
      const endPos = new THREE.Vector3(1, 2, 3);

      tool.onMouseUp(mockContext, {
        startGridPosition: startPos,
        currentGridPosition: endPos,
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(magicSelectCalled).toBe(true);
    });
  });

  describe("MoveSelection Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = new MoveSelectionTool();
    });

    it("should calculate grid position at hit voxel", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, attachMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });

    it("should call moveSelection reducer on mouse up with movement", () => {
      let moveSelectionCalled = false;
      let passedOffset: Vector3 | null = null;
      let beginCalled = false;
      let commitCalled = false;
      
      mockContext.reducers = {
        ...mockContext.reducers,
        moveSelection: (_projectId: string, offset: Vector3) => {
          moveSelectionCalled = true;
          passedOffset = offset;
        },
        beginSelectionMove: () => { beginCalled = true; },
        commitSelectionMove: () => { commitCalled = true; },
      };

      mockContext.projectManager = {
        ...mockContext.projectManager,
        chunkManager: {
          ...mockContext.projectManager.chunkManager,
          getObject: () => ({
            id: "obj1",
            projectId: "test-project",
            index: 0,
            name: "Object 1",
            visible: true,
            locked: false,
            position: { x: 0, y: 0, z: 0 },
            dimensions: { x: 64, y: 64, z: 64 },
            selection: null,
          }),
          getObjectContentBounds: () => ({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 5, y: 5, z: 5 },
          }),
        },
      } as unknown as ProjectManager;

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(1, 2, 3),
        mousePosition: new THREE.Vector2(0, 0),
      });

      expect(beginCalled).toBe(true);

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(4, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0)
      });

      expect(moveSelectionCalled).toBe(true);
      expect(passedOffset).not.toBeNull();
      expect(commitCalled).toBe(true);
    });

    it("should not call moveSelection reducer on mouse up without mouse movement", () => {
      let moveSelectionCalled = false;
      
      mockContext.reducers = {
        ...mockContext.reducers,
        moveSelection: () => {
          moveSelectionCalled = true;
        },
        beginSelectionMove: () => {},
        commitSelectionMove: () => {},
      };

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(1, 2, 3),
        mousePosition: new THREE.Vector2(0, 0),
      });

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(1, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0)
      });

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(1, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0)
      });

      expect(moveSelectionCalled).toBe(false);
    });

    it("should add bounds box to scene while dragging with content", () => {
      mockContext.projectManager = {
        ...mockContext.projectManager,
        chunkManager: {
          ...mockContext.projectManager.chunkManager,
          getObject: () => ({
            id: "obj1",
            projectId: "test-project",
            index: 0,
            name: "Object 1",
            visible: true,
            locked: false,
            position: { x: 0, y: 0, z: 0 },
            dimensions: { x: 64, y: 64, z: 64 },
            selection: null,
          }),
          getObjectContentBounds: () => ({
            min: { x: 10, y: 0, z: 10 },
            max: { x: 15, y: 4, z: 15 },
          }),
        },
      } as unknown as ProjectManager;

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(1, 2, 3),
        mousePosition: new THREE.Vector2(0, 0),
      });

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(4, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0),
      });

      const boxHelpers = mockContext.scene.children.filter(
        (c) => c instanceof THREE.Box3Helper
      );
      expect(boxHelpers.length).toBe(1);
    });

    it("should use selection bounds when object has a selection", () => {
      const selection = new VoxelFrame(
        { x: 3, y: 2, z: 4 },
        { x: 5, y: 6, z: 7 }
      );

      mockContext.projectManager = {
        ...mockContext.projectManager,
        chunkManager: {
          ...mockContext.projectManager.chunkManager,
          getObject: () => ({
            id: "obj1",
            projectId: "test-project",
            index: 0,
            name: "Object 1",
            visible: true,
            locked: false,
            position: { x: 0, y: 0, z: 0 },
            dimensions: { x: 64, y: 64, z: 64 },
            selection,
          }),
          getObjectContentBounds: () => ({
            min: { x: 0, y: 0, z: 0 },
            max: { x: 64, y: 64, z: 64 },
          }),
        },
      } as unknown as ProjectManager;

      tool.onActivate!(mockContext);

      const boxHelper = mockContext.scene.children.find(
        (c) => c instanceof THREE.Box3Helper
      ) as THREE.Box3Helper | undefined;
      expect(boxHelper).toBeDefined();
      expect(boxHelper!.box.min.x).toBe(5);
      expect(boxHelper!.box.min.y).toBe(6);
      expect(boxHelper!.box.min.z).toBe(7);
      expect(boxHelper!.box.max.x).toBe(8);
      expect(boxHelper!.box.max.y).toBe(8);
      expect(boxHelper!.box.max.z).toBe(11);
    });

    it("should use content bounds when object has no selection", () => {
      const contentBounds = {
        min: { x: 10, y: 0, z: 10 },
        max: { x: 15, y: 7, z: 15 },
      };

      mockContext.projectManager = {
        ...mockContext.projectManager,
        chunkManager: {
          ...mockContext.projectManager.chunkManager,
          getObject: () => ({
            id: "obj1",
            projectId: "test-project",
            index: 0,
            name: "Object 1",
            visible: true,
            locked: false,
            position: { x: 0, y: 0, z: 0 },
            dimensions: { x: 64, y: 64, z: 64 },
            selection: null,
          }),
          getObjectContentBounds: () => contentBounds,
        },
      } as unknown as ProjectManager;

      tool.onActivate!(mockContext);

      const boxHelper = mockContext.scene.children.find(
        (c) => c instanceof THREE.Box3Helper
      ) as THREE.Box3Helper | undefined;
      expect(boxHelper).toBeDefined();
      expect(boxHelper!.box.min.x).toBe(10);
      expect(boxHelper!.box.min.y).toBe(0);
      expect(boxHelper!.box.min.z).toBe(10);
      expect(boxHelper!.box.max.x).toBe(15);
      expect(boxHelper!.box.max.y).toBe(7);
      expect(boxHelper!.box.max.z).toBe(15);
    });

    it("should not add box when object does not exist", () => {
      mockContext.projectManager = {
        ...mockContext.projectManager,
        chunkManager: {
          ...mockContext.projectManager.chunkManager,
          getObject: () => undefined,
        },
      } as unknown as ProjectManager;

      tool.onActivate!(mockContext);

      const boxHelpers = mockContext.scene.children.filter(
        (c) => c instanceof THREE.Box3Helper
      );
      expect(boxHelpers.length).toBe(0);
    });

    it("should clean up box on dispose", () => {
      const contentBounds = {
        min: { x: 10, y: 0, z: 10 },
        max: { x: 15, y: 7, z: 15 },
      };

      mockContext.projectManager = {
        ...mockContext.projectManager,
        chunkManager: {
          ...mockContext.projectManager.chunkManager,
          getObject: () => ({
            id: "obj1",
            projectId: "test-project",
            index: 0,
            name: "Object 1",
            visible: true,
            locked: false,
            position: { x: 0, y: 0, z: 0 },
            dimensions: { x: 64, y: 64, z: 64 },
            selection: null,
          }),
          getObjectContentBounds: () => contentBounds,
        },
      } as unknown as ProjectManager;

      tool.onActivate!(mockContext);
      expect(mockContext.scene.children.some((c) => c instanceof THREE.Box3Helper)).toBe(true);

      tool.dispose!();
      expect(mockContext.scene.children.some((c) => c instanceof THREE.Box3Helper)).toBe(false);
    });
  });

  describe("BrushTool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = new BrushTool();
    });

    it("should return Brush Shape and Size options", () => {
      const options = tool.getOptions();
      expect(options).toHaveLength(2);
      expect(options[0].name).toBe("Brush Shape");
      expect(options[0].values).toEqual(["Sphere", "Cube", "Cylinder", "Diamond"]);
      expect(options[0].currentValue).toBe("Sphere");
      expect(options[1].name).toBe("Size");
      expect(options[1].currentValue).toBe("3");
      expect(options[1].type).toBe("slider");
      expect(options[1].min).toBe(1);
      expect(options[1].max).toBe(50);
    });

    it("should update brush shape option", () => {
      tool.setOption("Brush Shape", "Cube");
      const options = tool.getOptions();
      expect(options[0].currentValue).toBe("Cube");
    });

    it("should update size option", () => {
      tool.setOption("Size", "5");
      const options = tool.getOptions();
      expect(options[1].currentValue).toBe("5");
    });

    it("should calculate grid position above hit voxel in Attach mode", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, attachMode);
      expect(gridPos.y).toBe(3);
    });

    it("should calculate grid position at hit voxel in Erase mode", () => {
      const gridPosition = new THREE.Vector3(1, 2, 3);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(gridPosition, normal, eraseMode);
      expect(gridPos.y).toBe(2);
    });

    it("should not apply voxels on mouse down", () => {
      let applyFrameCalled = false;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: () => {
          applyFrameCalled = true;
        },
      };

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(5, 5, 5),
        mousePosition: new THREE.Vector2(0, 0),
      });

      expect(applyFrameCalled).toBe(false);
    });

    it("should apply voxels once on mouse up after stroke", () => {
      let applyCount = 0;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: () => {
          applyCount++;
        },
      };

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(5, 5, 5),
        mousePosition: new THREE.Vector2(0, 0),
      });

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(5, 5, 5),
        currentGridPosition: new THREE.Vector3(6, 5, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.1, 0),
      });

      expect(applyCount).toBe(0);

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(5, 5, 5),
        currentGridPosition: new THREE.Vector3(6, 5, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.1, 0),
      });

      expect(applyCount).toBe(1);
    });

    it("should not re-stamp at the same position during drag", () => {
      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(5, 5, 5),
        mousePosition: new THREE.Vector2(0, 0),
      });

      const valueBefore = mockContext.previewBuffer[5 * dimensions.y * dimensions.z + 5 * dimensions.z + 5];

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(5, 5, 5),
        currentGridPosition: new THREE.Vector3(5, 5, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(mockContext.previewBuffer[5 * dimensions.y * dimensions.z + 5 * dimensions.z + 5]).toBe(valueBefore);
    });

    it("should accumulate stamps in preview frame during stroke", () => {
      tool.setOption("Brush Shape", "Cube");
      tool.setOption("Size", "1");

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(2, 2, 2),
        mousePosition: new THREE.Vector2(0, 0),
      });

      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBeGreaterThan(0);

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(2, 2, 2),
        currentGridPosition: new THREE.Vector3(5, 5, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.1, 0.1),
      });

      expect(mockContext.previewBuffer[2 * dimensions.y * dimensions.z + 2 * dimensions.z + 2]).toBeGreaterThan(0);
      expect(mockContext.previewBuffer[5 * dimensions.y * dimensions.z + 5 * dimensions.z + 5]).toBeGreaterThan(0);
    });

    it("should create sphere-shaped stamp with default settings", () => {
      tool.setOption("Size", "3");

      let lastFrame: VoxelFrame | null = null;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: (_mode, _block, frame) => {
          lastFrame = frame.clone();
        },
      };

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(5, 5, 5),
        mousePosition: new THREE.Vector2(0, 0),
      });

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(5, 5, 5),
        currentGridPosition: new THREE.Vector3(5, 5, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(lastFrame).not.toBeNull();
      expect(lastFrame!.get(5, 5, 5)).toBeGreaterThan(0);
      expect(lastFrame!.get(4, 4, 4)).toBe(0);
    });

    it("should create cube-shaped stamp", () => {
      tool.setOption("Brush Shape", "Cube");
      tool.setOption("Size", "3");

      let lastFrame: VoxelFrame | null = null;
      mockContext.reducers = {
        ...mockContext.reducers,
        applyFrame: (_mode, _block, frame) => {
          lastFrame = frame.clone();
        },
      };

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(5, 5, 5),
        mousePosition: new THREE.Vector2(0, 0),
      });

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(5, 5, 5),
        currentGridPosition: new THREE.Vector3(5, 5, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(lastFrame).not.toBeNull();
      expect(lastFrame!.get(5, 5, 5)).toBeGreaterThan(0);
      expect(lastFrame!.get(4, 4, 4)).toBeGreaterThan(0);
      expect(lastFrame!.get(6, 6, 6)).toBeGreaterThan(0);
    });
  });

  describe("Benchmark", () => {
    it("should drag preview and apply across all fill shapes within 4 seconds", () => {
      const shapes = ["Rect", "Sphere", "Cylinder", "Triangle", "Diamond", "Cone", "Pyramid", "Hexagon"] as const;
      const SIZE = 150;
      const DRAG_STEPS = 8;
      const benchDimensions = { x: SIZE, y: SIZE, z: SIZE };

      const benchPreviewBuffer = new Uint8Array(benchDimensions.x * benchDimensions.y * benchDimensions.z);

      const benchContext: ToolContext = {
        ...mockContext,
        dimensions: benchDimensions,
        previewBuffer: benchPreviewBuffer,
        projectManager: {
          ...mockContext.projectManager,
          chunkManager: {
            updatePreview: () => {},
            clearPreview: () => {},
            previewBuffer: benchPreviewBuffer,
            getDimensions: () => benchDimensions,
          },
        } as unknown as ProjectManager,
      };

      const start = performance.now();

      for (const shape of shapes) {
        const tool = new RectTool();
        tool.setOption("Fill Shape", shape);

        for (let step = 1; step <= DRAG_STEPS; step++) {
          const progress = step / DRAG_STEPS;
          const currentPos = Math.floor(progress * (SIZE - 1));

          tool.onDrag(benchContext, {
            startGridPosition: new THREE.Vector3(0, 0, 0),
            currentGridPosition: new THREE.Vector3(currentPos, currentPos, currentPos),
            startMousePosition: new THREE.Vector2(0, 0),
            currentMousePosition: new THREE.Vector2(progress, progress),
          });
        }

        tool.onMouseUp(benchContext, {
          startGridPosition: new THREE.Vector3(0, 0, 0),
          currentGridPosition: new THREE.Vector3(SIZE - 1, SIZE - 1, SIZE - 1),
          startMousePosition: new THREE.Vector2(0, 0),
          currentMousePosition: new THREE.Vector2(1, 1),
        });

        tool.commitPendingOperation(benchContext);
      }

      const elapsed = performance.now() - start;
      console.log(`Preview drag + apply benchmark (all shapes, ${SIZE}^3, ${DRAG_STEPS} drag steps): ${elapsed.toFixed(0)}ms`);
      expect(elapsed).toBeLessThan(4000);
    }, 10000);
  });
});
