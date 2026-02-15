import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { FillShape } from "../tool-type";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { RectBounds } from "@/lib/rect-utils";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent, PendingBounds } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { isInsideFillShape } from "../fill-shape-utils";

export class RectTool implements Tool {
  private fillShape: FillShape = "Rect";
  private flipX: boolean = false;
  private flipY: boolean = false;
  private flipZ: boolean = false;
  private pending: {
    bounds: RectBounds;
    mode: BlockModificationMode;
    selectedBlock: number;
    selectedObject: number;
  } | null = null;

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

  private buildFrameFromBounds(context: ToolContext, bounds: RectBounds): void {
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

  private buildFrame(context: ToolContext, event: ToolDragEvent): void {
    const bounds = calculateRectBounds(
      event.startGridPosition,
      event.currentGridPosition,
      context.dimensions
    );
    this.buildFrameFromBounds(context, bounds);
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
    const bounds = calculateRectBounds(
      event.startGridPosition,
      event.currentGridPosition,
      context.dimensions
    );
    this.buildFrameFromBounds(context, bounds);
    context.projectManager.chunkManager.setPreview(context.previewFrame);

    this.pending = {
      bounds,
      mode: context.mode,
      selectedBlock: context.selectedBlock,
      selectedObject: context.selectedObject,
    };
  }

  hasPendingOperation(): boolean {
    return this.pending !== null;
  }

  getPendingBounds(): PendingBounds | null {
    if (!this.pending) return null;
    return { ...this.pending.bounds };
  }

  resizePendingBounds(context: ToolContext, bounds: PendingBounds): void {
    if (!this.pending) return;

    const clamp = (val: number, max: number) =>
      Math.max(0, Math.min(val, max - 1));

    this.pending.bounds = {
      minX: clamp(bounds.minX, context.dimensions.x),
      maxX: clamp(bounds.maxX, context.dimensions.x),
      minY: clamp(bounds.minY, context.dimensions.y),
      maxY: clamp(bounds.maxY, context.dimensions.y),
      minZ: clamp(bounds.minZ, context.dimensions.z),
      maxZ: clamp(bounds.maxZ, context.dimensions.z),
    };

    this.buildFrameFromBounds(context, this.pending.bounds);
    context.projectManager.chunkManager.setPreview(context.previewFrame);
  }

  commitPendingOperation(context: ToolContext): void {
    if (!this.pending) return;

    this.buildFrameFromBounds(context, this.pending.bounds);

    context.reducers.applyFrame(
      this.pending.mode,
      this.pending.selectedBlock,
      context.previewFrame,
      this.pending.selectedObject
    );

    context.previewFrame.clear();
    this.pending = null;
  }

  cancelPendingOperation(context: ToolContext): void {
    if (!this.pending) return;
    context.previewFrame.clear();
    context.projectManager.chunkManager.setPreview(context.previewFrame);
    this.pending = null;
  }
}
