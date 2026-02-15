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
import * as THREE from "three";
import { VoxelFrame } from "../flat-voxel-frame";

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
      commitSelectionMove: () => {},
      selectAllVoxels: () => {},
      deleteSelectedVoxels: () => {},
      updateBlockColor: () => {},
    };

    mockContext = {
      reducers,
      projectId: "test-project",
      dimensions,
      projectManager: {
        applyOptimisticRectEdit: () => {},
        getBlockAtPosition: () => 1,
        updateMoveSelectionBox: () => {},
        clearMoveSelectionBox: () => {},
        chunkManager: {
          setPreview: () => {},
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
    it("should return fill shape and flip options for RectTool", () => {
      const tool = new RectTool();
      const options = tool.getOptions();
      
      expect(options).toHaveLength(4);
      expect(options[0].name).toBe("Fill Shape");
      expect(options[0].values).toEqual(["Rect", "Sphere", "Cylinder", "Triangle", "Diamond", "Cone", "Pyramid", "Hexagon", "Star", "Cross"]);
      expect(options[0].currentValue).toBe("Rect");
      expect(options[1].name).toBe("Flip X");
      expect(options[1].currentValue).toBe("Off");
      expect(options[2].name).toBe("Flip Y");
      expect(options[2].currentValue).toBe("Off");
      expect(options[3].name).toBe("Flip Z");
      expect(options[3].currentValue).toBe("Off");
    });

    it("should update fill shape option on RectTool", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Sphere");
      
      const options = tool.getOptions();
      expect(options[0].currentValue).toBe("Sphere");
    });

    it("should toggle flip options on RectTool", () => {
      const tool = new RectTool();
      tool.setOption("Flip Y", "On");
      
      const options = tool.getOptions();
      expect(options[1].currentValue).toBe("Off");
      expect(options[2].currentValue).toBe("On");
      expect(options[3].currentValue).toBe("Off");
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
      
      expect(mockContext.previewFrame.get(1, 2, 3)).toBeGreaterThan(0);
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

      expect(mockContext.previewFrame.get(0, 0, 0)).toBeGreaterThan(0);
      expect(mockContext.previewFrame.get(1, 1, 1)).toBeGreaterThan(0);
      expect(mockContext.previewFrame.get(2, 2, 2)).toBeGreaterThan(0);
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

      expect(mockContext.previewFrame.get(1, 1, 1)).toBeGreaterThan(0);
      expect(mockContext.previewFrame.get(0, 0, 0)).toBe(0);
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

      expect(mockContext.previewFrame.get(2, 2, 2)).toBeGreaterThan(0);
      expect(mockContext.previewFrame.get(0, 2, 0)).toBe(0);
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

      expect(mockContext.previewFrame.get(2, 2, 2)).toBeGreaterThan(0);
      expect(mockContext.previewFrame.get(0, 0, 0)).toBe(0);
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

      expect(mockContext.previewFrame.get(1, 1, 1)).toBeGreaterThan(0);
      expect(mockContext.previewFrame.get(2, 2, 2)).toBeGreaterThan(0);
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

    it("should cancel pending operation and clear preview", () => {
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 1, 1),
        currentGridPosition: new THREE.Vector3(3, 3, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      tool.cancelPendingOperation(mockContext);
      expect(tool.hasPendingOperation()).toBe(false);
      expect(mockContext.previewFrame.get(2, 2, 2)).toBe(0);
    });

    it("should recalculate shape when resizing pending bounds", () => {
      tool.setOption("Fill Shape", "Sphere");

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(0, 0, 0),
        currentGridPosition: new THREE.Vector3(4, 4, 4),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      const originalCenter = mockContext.previewFrame.get(2, 2, 2);
      expect(originalCenter).toBeGreaterThan(0);

      tool.resizePendingBounds(mockContext, {
        minX: 0, maxX: 6,
        minY: 0, maxY: 6,
        minZ: 0, maxZ: 6,
      });

      expect(tool.getPendingBounds()!.maxX).toBe(6);
      expect(mockContext.previewFrame.get(3, 3, 3)).toBeGreaterThan(0);
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

    it("should call commitSelectionMove reducer on mouse up with movement", () => {
      let commitSelectionMoveCalled = false;
      let passedOffset: Vector3 | null = null;
      
      mockContext.reducers = {
        ...mockContext.reducers,
        commitSelectionMove: (_projectId: string, offset: Vector3) => {
          commitSelectionMoveCalled = true;
          passedOffset = offset;
        },
      };

      tool.onMouseDown(mockContext, {
        gridPosition: new THREE.Vector3(1, 2, 3),
        mousePosition: new THREE.Vector2(0, 0),
      });

      // Simulate drag with movement
      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(4, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0)
      });

      // Should not be called during drag
      expect(commitSelectionMoveCalled).toBe(false);

      // Call mouse up
      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(4, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0)
      });

      // Should be called on mouse up
      expect(commitSelectionMoveCalled).toBe(true);
      expect(passedOffset).not.toBeNull();
    });

    it("should not call commitSelectionMove reducer on mouse up without mouse movement", () => {
      let commitSelectionMoveCalled = false;
      
      mockContext.reducers = {
        ...mockContext.reducers,
        commitSelectionMove: () => {
          commitSelectionMoveCalled = true;
        },
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

      expect(commitSelectionMoveCalled).toBe(false);
    });

    it("should update move selection box while dragging", () => {
      let moveSelectionBoxUpdated = false;
      mockContext.projectManager = {
        ...mockContext.projectManager,
        updateMoveSelectionBox: () => {
          moveSelectionBoxUpdated = true;
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

      expect(moveSelectionBoxUpdated).toBe(true);
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
      expect(options[0].values).toEqual(["Sphere", "Cube", "Cylinder", "Diamond", "Cross"]);
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

    it("should apply voxels on mouse down", () => {
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

      expect(applyFrameCalled).toBe(true);
    });

    it("should apply voxels on drag to new positions", () => {
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

      expect(applyCount).toBe(2);
    });

    it("should not re-apply at the same position", () => {
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
        currentGridPosition: new THREE.Vector3(5, 5, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0),
      });

      expect(applyCount).toBe(1);
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

      expect(lastFrame).not.toBeNull();
      expect(lastFrame!.get(5, 5, 5)).toBeGreaterThan(0);
      expect(lastFrame!.get(4, 4, 4)).toBeGreaterThan(0);
      expect(lastFrame!.get(6, 6, 6)).toBeGreaterThan(0);
    });
  });

  describe("Benchmark", () => {
    it("should drag preview and apply across all fill shapes within 5 seconds", () => {
      const shapes = ["Rect", "Sphere", "Cylinder", "Triangle", "Diamond", "Cone", "Pyramid", "Hexagon", "Star", "Cross"] as const;
      const SIZE = 150;
      const DRAG_STEPS = 8;
      const benchDimensions = { x: SIZE, y: SIZE, z: SIZE };

      const benchContext: ToolContext = {
        ...mockContext,
        dimensions: benchDimensions,
        previewFrame: new VoxelFrame(benchDimensions),
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
      expect(elapsed).toBeLessThan(5000);
    }, 10000);
  });
});
