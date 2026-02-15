import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType, BrushShape } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { isInsideFillShape } from "../fill-shape-utils";
import type { FillShape } from "../tool-type";

const BRUSH_SHAPE_TO_FILL_SHAPE: Record<BrushShape, FillShape> = {
  Sphere: "Sphere",
  Cube: "Rect",
  Cylinder: "Cylinder",
  Diamond: "Diamond",
  Cross: "Cross",
};

export class BrushTool implements Tool {
  private brushShape: BrushShape = "Sphere";
  private size: number = 3;
  private lastAppliedPosition: THREE.Vector3 | null = null;

  getType(): ToolType {
    return "Brush";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Brush Shape",
        values: ["Sphere", "Cube", "Cylinder", "Diamond", "Cross"],
        currentValue: this.brushShape,
      },
      {
        name: "Size",
        values: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        currentValue: String(this.size),
      },
    ];
  }

  setOption(name: string, value: string): void {
    if (name === "Brush Shape") {
      this.brushShape = value as BrushShape;
    } else if (name === "Size") {
      this.size = parseInt(value, 10);
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

  private getBlockValue(mode: BlockModificationMode, selectedBlock: number): number {
    switch (mode.tag) {
      case "Attach":
        return selectedBlock;
      case "Paint":
        return selectedBlock | RAYCASTABLE_BIT;
      case "Erase":
        return RAYCASTABLE_BIT;
    }
  }

  private stampAtPosition(context: ToolContext, center: THREE.Vector3): void {
    const halfSize = Math.floor(this.size / 2);
    const minX = Math.max(0, center.x - halfSize);
    const minY = Math.max(0, center.y - halfSize);
    const minZ = Math.max(0, center.z - halfSize);
    const maxX = Math.min(context.dimensions.x - 1, center.x + halfSize);
    const maxY = Math.min(context.dimensions.y - 1, center.y + halfSize);
    const maxZ = Math.min(context.dimensions.z - 1, center.z + halfSize);

    const boundsMinX = center.x - halfSize;
    const boundsMinY = center.y - halfSize;
    const boundsMinZ = center.z - halfSize;
    const boundsMaxX = center.x + halfSize;
    const boundsMaxY = center.y + halfSize;
    const boundsMaxZ = center.z + halfSize;

    const fillShape = BRUSH_SHAPE_TO_FILL_SHAPE[this.brushShape];
    const blockValue = this.getBlockValue(context.mode, context.selectedBlock);

    const frameSize = {
      x: maxX - minX + 1,
      y: maxY - minY + 1,
      z: maxZ - minZ + 1,
    };
    const frameMinPos = { x: minX, y: minY, z: minZ };

    context.previewFrame.clear();
    context.previewFrame.resize(frameSize, frameMinPos);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (isInsideFillShape(fillShape, x, y, z, boundsMinX, boundsMaxX, boundsMinY, boundsMaxY, boundsMinZ, boundsMaxZ)) {
            context.previewFrame.set(x, y, z, blockValue);
          }
        }
      }
    }

    context.reducers.applyFrame(
      context.mode,
      context.selectedBlock,
      context.previewFrame,
      context.selectedObject
    );

    context.previewFrame.clear();
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    this.lastAppliedPosition = event.gridPosition.clone();
    this.stampAtPosition(context, event.gridPosition);
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    if (
      this.lastAppliedPosition &&
      this.lastAppliedPosition.equals(event.currentGridPosition)
    ) {
      return;
    }

    this.lastAppliedPosition = event.currentGridPosition.clone();
    this.stampAtPosition(context, event.currentGridPosition);
  }

  onMouseUp(_context: ToolContext, _event: ToolDragEvent): void {
    this.lastAppliedPosition = null;
  }
}
