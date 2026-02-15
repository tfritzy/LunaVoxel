import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType, BrushShape, FillShape } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { isInsideFillShape } from "../fill-shape-utils";
import { calculateRectBounds } from "@/lib/rect-utils";

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
        values: [],
        currentValue: String(this.size),
        type: "slider",
        min: 1,
        max: 50,
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
    const halfBelow = Math.ceil(this.size / 2) - 1;
    const halfAbove = Math.floor(this.size / 2);

    const stampStart = {
      x: center.x - halfBelow,
      y: center.y - halfBelow,
      z: center.z - halfBelow,
    };
    const stampEnd = {
      x: center.x + halfAbove,
      y: center.y + halfAbove,
      z: center.z + halfAbove,
    };

    const bounds = calculateRectBounds(stampStart, stampEnd, context.dimensions);

    const fillShape = BRUSH_SHAPE_TO_FILL_SHAPE[this.brushShape];
    const blockValue = this.getBlockValue(context.mode, context.selectedBlock);

    const frameSize = {
      x: bounds.maxX - bounds.minX + 1,
      y: bounds.maxY - bounds.minY + 1,
      z: bounds.maxZ - bounds.minZ + 1,
    };
    const frameMinPos = { x: bounds.minX, y: bounds.minY, z: bounds.minZ };

    context.previewFrame.clear();
    context.previewFrame.resize(frameSize, frameMinPos);

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          if (isInsideFillShape(
            fillShape, x, y, z,
            stampStart.x, stampEnd.x,
            stampStart.y, stampEnd.y,
            stampStart.z, stampEnd.z
          )) {
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
