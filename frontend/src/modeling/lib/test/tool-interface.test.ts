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

describe("Tool Interface", () => {
  let mockContext: ToolContext;
  let renderTreeWrites: { x: number; y: number; z: number; value: number }[] = [];
  let revertCalled = false;
  const dimensions: Vector3 = { x: 10, y: 10, z: 10 };
  const attachMode: BlockModificationMode = { tag: "Attach" };
  const eraseMode: BlockModificationMode = { tag: "Erase" };
  const paintMode: BlockModificationMode = { tag: "Paint" };

  beforeEach(() => {
    renderTreeWrites = [];
    revertCalled = false;
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const reducers: Reducers = {
      updateProjectName: () => {},
      addBlock: () => {},
      updateBlock: () => {},
      deleteBlock: () => {},
      addLayer: () => {},
      deleteLayer: () => {},
      toggleLayerVisibility: () => {},
      toggleLayerLock: () => {},
      reorderLayers: () => {},
      modifyBlockRect: () => {},
      undoEdit: () => {},
      updateCursorPos: () => {},
      magicSelect: () => {},
      commitSelectionMove: () => {},
    };

    mockContext = {
      reducers,
      projectId: "test-project",
      dimensions,
      projectManager: {
        getBlockAtPosition: () => 1,
        octreeManager: {
          writeToRenderTree: (positions: { x: number; y: number; z: number; value: number }[]) => {
            renderTreeWrites = positions;
          },
          revertRenderTree: () => {
            revertCalled = true;
          },
        },
      } as unknown as ProjectManager,
      selectedBlock: 1,
      selectedLayer: 0,
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

  describe("RectTool with modes", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = new RectTool();
    });

    it("should calculate grid position with positive offset in Attach mode", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal, attachMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });

    it("should calculate grid position with negative offset in Erase mode", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal, eraseMode);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });

    it("should calculate grid position with negative offset in Paint mode", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal, paintMode);
      
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
      
      expect(revertCalled).toBe(true);
      expect(renderTreeWrites.length).toBeGreaterThan(0);
      const hasBlock = renderTreeWrites.some(
        (p) => p.x === 1 && p.y === 2 && p.z === 3
      );
      expect(hasBlock).toBe(true);
    });
  });

  describe("BlockPicker Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = new BlockPickerTool();
    });

    it("should calculate grid position with negative offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal, attachMode);
      
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

    it("should calculate grid position with negative offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal, attachMode);
      
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

    it("should calculate grid position with negative offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal, attachMode);
      
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
  });
});
