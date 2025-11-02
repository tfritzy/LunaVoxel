import { describe, it, expect, beforeEach } from "vitest";
import { createTool } from "../tools";
import type { Tool, ToolContext } from "../tool-interface";
import type { Vector3 } from "@/module_bindings";
import * as THREE from "three";
import { VoxelFrame } from "../voxel-frame";

describe("Tool Interface", () => {
  let mockContext: ToolContext;
  const dimensions: Vector3 = { x: 10, y: 10, z: 10 };

  beforeEach(() => {
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
    };
  });

  describe("Tool Factory", () => {
    it("should create Build tool", () => {
      const tool = createTool({ tag: "Build" });
      expect(tool.getType()).toEqual({ tag: "Build" });
    });

    it("should create Erase tool", () => {
      const tool = createTool({ tag: "Erase" });
      expect(tool.getType()).toEqual({ tag: "Erase" });
    });

    it("should create Paint tool", () => {
      const tool = createTool({ tag: "Paint" });
      expect(tool.getType()).toEqual({ tag: "Paint" });
    });

    it("should create BlockPicker tool", () => {
      const tool = createTool({ tag: "BlockPicker" });
      expect(tool.getType()).toEqual({ tag: "BlockPicker" });
    });

    it("should create MagicSelect tool", () => {
      const tool = createTool({ tag: "MagicSelect" });
      expect(tool.getType()).toEqual({ tag: "MagicSelect" });
    });
  });

  describe("Build Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = createTool({ tag: "Build" });
    });

    it("should calculate grid position with positive offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0); // Up
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal);
      
      // Build tool adds 0.1 in the normal direction, then floors
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2); // 2.5 + 0.1 = 2.6, floor = 2
      expect(gridPos.z).toBe(3);
    });

    it("should show preview on drag", () => {
      const startPos = new THREE.Vector3(1, 2, 3);
      const endPos = new THREE.Vector3(3, 4, 5);
      
      tool.onDrag(mockContext, startPos, endPos);
      
      // Check that preview frame was updated
      expect(mockContext.previewFrame.get(1, 2, 3)).toBeGreaterThan(0);
    });
  });

  describe("Erase Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = createTool({ tag: "Erase" });
    });

    it("should calculate grid position with negative offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0); // Up
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal);
      
      // Erase tool subtracts 0.1 in the normal direction, then floors
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2); // 2.5 - 0.1 = 2.4, floor = 2
      expect(gridPos.z).toBe(3);
    });
  });

  describe("Paint Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = createTool({ tag: "Paint" });
    });

    it("should calculate grid position with negative offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal);
      
      expect(gridPos.x).toBe(1);
      expect(gridPos.y).toBe(2);
      expect(gridPos.z).toBe(3);
    });
  });

  describe("BlockPicker Tool", () => {
    let tool: Tool;

    beforeEach(() => {
      tool = createTool({ tag: "BlockPicker" });
    });

    it("should calculate grid position with negative offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal);
      
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
      tool = createTool({ tag: "MagicSelect" });
    });

    it("should calculate grid position with negative offset", () => {
      const intersectionPoint = new THREE.Vector3(1.5, 2.5, 3.5);
      const normal = new THREE.Vector3(0, 1, 0);
      const gridPos = tool.calculateGridPosition(intersectionPoint, normal);
      
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
});
