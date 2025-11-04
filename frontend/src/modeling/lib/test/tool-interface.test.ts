import { describe, it, expect, beforeEach } from "vitest";
import { RectTool } from "../tools/rect-tool";
import { BlockPickerTool } from "../tools/block-picker-tool";
import { MagicSelectTool } from "../tools/magic-select-tool";
import { MoveSelectionTool } from "../tools/move-selection-tool";
import type { Tool, ToolContext } from "../tool-interface";
import type { Vector3, BlockModificationMode } from "@/module_bindings";
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

    mockContext = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dbConn: {} as any,
      projectId: "test-project",
      dimensions,
      projectManager: {
        onPreviewUpdate: () => {},
        applyOptimisticRectEdit: () => {},
        getBlockAtPosition: () => 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      previewFrame: new VoxelFrame(dimensions),
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
      
      expect(mockContext.previewFrame.get(1, 2, 3)).toBeGreaterThan(0);
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

      tool.onMouseUp(mockContext, startPos, endPos);

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
      mockContext.dbConn = {
        reducers: {
          magicSelect: () => {
            magicSelectCalled = true;
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const startPos = new THREE.Vector3(1, 2, 3);
      const endPos = new THREE.Vector3(1, 2, 3);

      tool.onMouseUp(mockContext, startPos, endPos);

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

    it("should call moveSelection reducer on drag with movement", () => {
      let moveSelectionCalled = false;
      let passedOffset: Vector3 | null = null;
      
      mockContext.dbConn = {
        reducers: {
          moveSelection: (_projectId: string, offset: Vector3) => {
            moveSelectionCalled = true;
            passedOffset = offset;
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(4, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0.5, 0)
      });

      expect(moveSelectionCalled).toBe(true);
      expect(passedOffset).not.toBeNull();
    });

    it("should not call moveSelection reducer on drag without mouse movement", () => {
      let moveSelectionCalled = false;
      
      mockContext.dbConn = {
        reducers: {
          moveSelection: () => {
            moveSelectionCalled = true;
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      tool.onDrag(mockContext, {
        startGridPosition: new THREE.Vector3(1, 2, 3),
        currentGridPosition: new THREE.Vector3(1, 2, 3),
        startMousePosition: new THREE.Vector2(0, 0),
        currentMousePosition: new THREE.Vector2(0, 0)
      });

      expect(moveSelectionCalled).toBe(false);
    });
  });
});
