import { describe, it, expect, beforeEach } from "vitest";
import { RectTool } from "../tools/rect-tool";
import { BlockPickerTool } from "../tools/block-picker-tool";
import { MagicSelectTool } from "../tools/magic-select-tool";
import { MoveSelectionTool } from "../tools/move-selection-tool";
import type { Tool, ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode } from "@/state/types";
import type { Reducers } from "@/state/store";
import type { ProjectManager } from "../project-manager";
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
      modifyBlockRect: () => {},
      modifyBlockSphere: () => {},
      undoEdit: () => {},
      updateCursorPos: () => {},
      magicSelect: () => {},
      commitSelectionMove: () => {},
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
  });

  describe("Tool Options", () => {
    it("should return fill shape options for RectTool", () => {
      const tool = new RectTool();
      const options = tool.getOptions();
      
      expect(options).toHaveLength(1);
      expect(options[0].name).toBe("Fill Shape");
      expect(options[0].values).toEqual(["Rect", "Sphere", "Cylinder", "Triangle", "Diamond"]);
      expect(options[0].currentValue).toBe("Rect");
    });

    it("should update fill shape option on RectTool", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Sphere");
      
      const options = tool.getOptions();
      expect(options[0].currentValue).toBe("Sphere");
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

    it("should dispatch sphere edit on mouse up with Sphere fill shape", () => {
      const tool = new RectTool();
      tool.setOption("Fill Shape", "Sphere");
      
      let called = false;
      mockContext.reducers = {
        ...mockContext.reducers,
        modifyBlockSphere: () => {
          called = true;
        },
      };

      tool.onMouseUp(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(3, 4, 5),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0.5),
      });

      expect(called).toBe(true);
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
});
