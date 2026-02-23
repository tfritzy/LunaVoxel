import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType, BrushShape, FillShape } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { isInsideFillShapePrecomputed, precomputeShapeParams } from "../fill-shape-utils";
import { VoxelFrame } from "../voxel-frame";

const BRUSH_SHAPE_TO_FILL_SHAPE: Record<BrushShape, FillShape> = {
  Sphere: "Sphere",
  Cube: "Rect",
  Cylinder: "Cylinder",
  Diamond: "Diamond",
};

export class BrushTool implements Tool {
  private brushShape: BrushShape = "Sphere";
  private size: number = 3;
  private lastAppliedPosition: THREE.Vector3 | null = null;
  private isStrokeActive: boolean = false;
  private strokeMode: BlockModificationMode | null = null;
  private strokeSelectedBlock: number = 0;
  private strokeSelectedObjectId: string = '';

  getType(): ToolType {
    return "Brush";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Brush Shape",
        values: ["Sphere", "Cube", "Cylinder", "Diamond"],
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
    const dims = getActiveObject(context)!.dimensions;
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
    const maxX = Math.min(dims.x - 1, boundsMaxX);
    const maxY = Math.min(dims.y - 1, boundsMaxY);
    const maxZ = Math.min(dims.z - 1, boundsMaxZ);

    const fillShape = BRUSH_SHAPE_TO_FILL_SHAPE[this.brushShape];
    const blockValue = this.getBlockValue(context.mode, context.selectedBlock);
    const dimY = dims.y;
    const dimZ = dims.z;
    const shapeParams = precomputeShapeParams(boundsMinX, boundsMaxX, boundsMinY, boundsMaxY, boundsMinZ, boundsMaxZ);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (isInsideFillShapePrecomputed(fillShape, x, y, z, shapeParams)) {
            context.previewBuffer[x * dimY * dimZ + y * dimZ + z] = blockValue;
          }
        }
      }
    }

    context.projectManager.chunkManager.updatePreview(minX, minY, minZ, maxX, maxY, maxZ);
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    this.isStrokeActive = true;
    this.strokeMode = context.mode;
    this.strokeSelectedBlock = context.selectedBlock;
    this.strokeSelectedObjectId = getActiveObject(context)?.id ?? "";
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

  onMouseUp(context: ToolContext, _event: ToolDragEvent): void {
    if (this.isStrokeActive) {
      const dims = getActiveObject(context)!.dimensions;
      const frame = new VoxelFrame(dims, { x: 0, y: 0, z: 0 }, new Uint8Array(context.previewBuffer));

      context.reducers.applyFrame(
        this.strokeMode!,
        this.strokeSelectedBlock,
        frame,
        this.strokeSelectedObjectId
      );

      context.previewBuffer.fill(0);
      context.projectManager.chunkManager.clearPreview();
    }

    this.lastAppliedPosition = null;
    this.isStrokeActive = false;
    this.strokeMode = null;
  }
}
