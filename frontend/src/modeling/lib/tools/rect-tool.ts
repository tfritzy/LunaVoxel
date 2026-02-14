import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { FillShape } from "../tool-type";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { isInsideFillShape } from "../fill-shape-utils";

export class RectTool implements Tool {
  private fillShape: FillShape = "Rect";
  private flipX: boolean = false;
  private flipY: boolean = false;
  private flipZ: boolean = false;

  getType(): ToolType {
    return "Rect";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Fill Shape",
        values: ["Rect", "Sphere", "Cylinder", "Triangle", "Diamond", "Cone", "Pyramid", "Hexagon", "Star", "Cross"],
        currentValue: this.fillShape,
      },
      {
        name: "Flip X",
        values: ["Off", "On"],
        currentValue: this.flipX ? "On" : "Off",
      },
      {
        name: "Flip Y",
        values: ["Off", "On"],
        currentValue: this.flipY ? "On" : "Off",
      },
      {
        name: "Flip Z",
        values: ["Off", "On"],
        currentValue: this.flipZ ? "On" : "Off",
      },
    ];
  }

  setOption(name: string, value: string): void {
    if (name === "Fill Shape") {
      this.fillShape = value as FillShape;
    } else if (name === "Flip X") {
      this.flipX = value === "On";
    } else if (name === "Flip Y") {
      this.flipY = value === "On";
    } else if (name === "Flip Z") {
      this.flipZ = value === "On";
    }
  }

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3,
    mode: BlockModificationMode
  ): THREE.Vector3 {
    const direction = mode.tag === "Attach" ? "above" : "under";
    return calculateGridPositionWithMode(gridPosition, normal, direction);
  }

  private getPreviewBlockValue(mode: BlockModificationMode, selectedBlock: number): number {
    switch (mode.tag) {
      case "Attach":
        return selectedBlock;
      case "Paint":
        return selectedBlock | RAYCASTABLE_BIT;
      case "Erase":
        return RAYCASTABLE_BIT;
    }
  }

  private buildFrame(context: ToolContext, event: ToolDragEvent): void {
    const bounds = calculateRectBounds(
      event.startGridPosition,
      event.currentGridPosition,
      context.dimensions
    );

    const frameSize = {
      x: bounds.maxX - bounds.minX + 1,
      y: bounds.maxY - bounds.minY + 1,
      z: bounds.maxZ - bounds.minZ + 1,
    };
    const frameMinPos = {
      x: bounds.minX,
      y: bounds.minY,
      z: bounds.minZ,
    };

    context.previewFrame.clear();
    context.previewFrame.resize(frameSize, frameMinPos);

    const previewValue = this.getPreviewBlockValue(context.mode, context.selectedBlock);
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          const sx = this.flipX ? bounds.minX + bounds.maxX - x : x;
          const sy = this.flipY ? bounds.minY + bounds.maxY - y : y;
          const sz = this.flipZ ? bounds.minZ + bounds.maxZ - z : z;
          if (isInsideFillShape(this.fillShape, sx, sy, sz, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ)) {
            context.previewFrame.set(x, y, z, previewValue);
          }
        }
      }
    }
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    void context;
    void event;
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    this.buildFrame(context, event);
    context.projectManager.chunkManager.setPreview(context.previewFrame);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    this.buildFrame(context, event);

    context.reducers.applyFrame(
      context.mode,
      context.selectedBlock,
      context.previewFrame,
      context.selectedObject
    );

    context.previewFrame.clear();
  }
}
