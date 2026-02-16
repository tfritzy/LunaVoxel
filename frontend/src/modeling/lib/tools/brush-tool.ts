import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType, BrushShape, FillShape } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { isInsideFillShape } from "../fill-shape-utils";

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
  private isStrokeActive: boolean = false;
  private strokeMode: BlockModificationMode | null = null;
  private strokeSelectedBlock: number = 0;
  private strokeSelectedObject: number = 0;
  private accMinX: number = 0;
  private accMinY: number = 0;
  private accMinZ: number = 0;
  private accMaxX: number = 0;
  private accMaxY: number = 0;
  private accMaxZ: number = 0;

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

    const boundsMinX = center.x - halfBelow;
    const boundsMinY = center.y - halfBelow;
    const boundsMinZ = center.z - halfBelow;
    const boundsMaxX = center.x + halfAbove;
    const boundsMaxY = center.y + halfAbove;
    const boundsMaxZ = center.z + halfAbove;

    const minX = Math.max(0, boundsMinX);
    const minY = Math.max(0, boundsMinY);
    const minZ = Math.max(0, boundsMinZ);
    const maxX = Math.min(context.dimensions.x - 1, boundsMaxX);
    const maxY = Math.min(context.dimensions.y - 1, boundsMaxY);
    const maxZ = Math.min(context.dimensions.z - 1, boundsMaxZ);

    const newAccMinX = Math.min(this.accMinX, minX);
    const newAccMinY = Math.min(this.accMinY, minY);
    const newAccMinZ = Math.min(this.accMinZ, minZ);
    const newAccMaxX = Math.max(this.accMaxX, maxX);
    const newAccMaxY = Math.max(this.accMaxY, maxY);
    const newAccMaxZ = Math.max(this.accMaxZ, maxZ);

    const needsResize =
      newAccMinX !== this.accMinX || newAccMinY !== this.accMinY || newAccMinZ !== this.accMinZ ||
      newAccMaxX !== this.accMaxX || newAccMaxY !== this.accMaxY || newAccMaxZ !== this.accMaxZ;

    if (needsResize) {
      this.accMinX = newAccMinX;
      this.accMinY = newAccMinY;
      this.accMinZ = newAccMinZ;
      this.accMaxX = newAccMaxX;
      this.accMaxY = newAccMaxY;
      this.accMaxZ = newAccMaxZ;

      const frameSize = {
        x: this.accMaxX - this.accMinX + 1,
        y: this.accMaxY - this.accMinY + 1,
        z: this.accMaxZ - this.accMinZ + 1,
      };
      const frameMinPos = { x: this.accMinX, y: this.accMinY, z: this.accMinZ };
      context.previewFrame.resize(frameSize, frameMinPos);
    }

    const fillShape = BRUSH_SHAPE_TO_FILL_SHAPE[this.brushShape];
    const blockValue = this.getBlockValue(context.mode, context.selectedBlock);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (isInsideFillShape(
            fillShape, x, y, z,
            boundsMinX, boundsMaxX,
            boundsMinY, boundsMaxY,
            boundsMinZ, boundsMaxZ
          )) {
            context.previewFrame.set(x, y, z, blockValue);
          }
        }
      }
    }

    context.projectManager.chunkManager.setPreview(context.previewFrame);
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    this.isStrokeActive = true;
    this.strokeMode = context.mode;
    this.strokeSelectedBlock = context.selectedBlock;
    this.strokeSelectedObject = context.selectedObject;
    this.lastAppliedPosition = event.gridPosition.clone();

    const halfBelow = Math.ceil(this.size / 2) - 1;
    const halfAbove = Math.floor(this.size / 2);
    this.accMinX = Math.max(0, event.gridPosition.x - halfBelow);
    this.accMinY = Math.max(0, event.gridPosition.y - halfBelow);
    this.accMinZ = Math.max(0, event.gridPosition.z - halfBelow);
    this.accMaxX = Math.min(context.dimensions.x - 1, event.gridPosition.x + halfAbove);
    this.accMaxY = Math.min(context.dimensions.y - 1, event.gridPosition.y + halfAbove);
    this.accMaxZ = Math.min(context.dimensions.z - 1, event.gridPosition.z + halfAbove);

    const frameSize = {
      x: this.accMaxX - this.accMinX + 1,
      y: this.accMaxY - this.accMinY + 1,
      z: this.accMaxZ - this.accMinZ + 1,
    };
    const frameMinPos = { x: this.accMinX, y: this.accMinY, z: this.accMinZ };
    context.previewFrame.clear();
    context.previewFrame.resize(frameSize, frameMinPos);

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

  onMouseUp(context: ToolContext, _event: ToolDragEvent): void {
    if (this.isStrokeActive) {
      context.reducers.applyFrame(
        this.strokeMode!,
        this.strokeSelectedBlock,
        context.previewFrame,
        this.strokeSelectedObject
      );

      context.previewFrame.clear();
      context.projectManager.chunkManager.setPreview(context.previewFrame);
    }

    this.lastAppliedPosition = null;
    this.isStrokeActive = false;
    this.strokeMode = null;
  }
}
