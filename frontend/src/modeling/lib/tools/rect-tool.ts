import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { FillShape } from "../tool-type";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";

export class RectTool implements Tool {
  private fillShape: FillShape = "Rect";

  getType(): ToolType {
    return "Rect";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Fill Shape",
        values: ["Rect", "Sphere", "Cylinder", "Triangle", "Diamond"],
        currentValue: this.fillShape,
      },
    ];
  }

  setOption(name: string, value: string): void {
    if (name === "Fill Shape") {
      this.fillShape = value as FillShape;
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

  private isInsideShape(
    x: number,
    y: number,
    z: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number
  ): boolean {
    switch (this.fillShape) {
      case "Rect":
        return true;
      case "Sphere":
        return this.isInsideSphere(x, y, z, minX, maxX, minY, maxY, minZ, maxZ);
      case "Cylinder":
        return this.isInsideCylinder(x, z, minX, maxX, minZ, maxZ);
      case "Triangle":
        return this.isInsideTriangle(x, y, minX, maxX, minY, maxY);
      case "Diamond":
        return this.isInsideDiamond(x, y, z, minX, maxX, minY, maxY, minZ, maxZ);
    }
  }

  private isInsideSphere(
    x: number,
    y: number,
    z: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number
  ): boolean {
    const radiusX = (maxX - minX + 1) / 2;
    const radiusY = (maxY - minY + 1) / 2;
    const radiusZ = (maxZ - minZ + 1) / 2;
    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;
    const centerZ = (minZ + maxZ + 1) / 2;
    const dx = (x + 0.5 - centerX) / radiusX;
    const dy = (y + 0.5 - centerY) / radiusY;
    const dz = (z + 0.5 - centerZ) / radiusZ;

    return dx * dx + dy * dy + dz * dz <= 1;
  }

  private isInsideCylinder(
    x: number,
    z: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
  ): boolean {
    const radiusX = (maxX - minX + 1) / 2;
    const radiusZ = (maxZ - minZ + 1) / 2;
    const centerX = (minX + maxX + 1) / 2;
    const centerZ = (minZ + maxZ + 1) / 2;
    const dx = (x + 0.5 - centerX) / radiusX;
    const dz = (z + 0.5 - centerZ) / radiusZ;

    return dx * dx + dz * dz <= 1;
  }

  private isInsideTriangle(
    x: number,
    y: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): boolean {
    const height = maxY - minY + 1;
    const width = maxX - minX + 1;
    const row = y - minY;
    const fraction = (row + 0.5) / height;
    const rowWidth = width * fraction;
    const centerX = (minX + maxX + 1) / 2;
    const dx = Math.abs(x + 0.5 - centerX);

    return dx <= rowWidth / 2;
  }

  private isInsideDiamond(
    x: number,
    y: number,
    z: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number
  ): boolean {
    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;
    const centerZ = (minZ + maxZ + 1) / 2;
    const radiusX = (maxX - minX + 1) / 2;
    const radiusY = (maxY - minY + 1) / 2;
    const radiusZ = (maxZ - minZ + 1) / 2;
    const dx = Math.abs(x + 0.5 - centerX) / radiusX;
    const dy = Math.abs(y + 0.5 - centerY) / radiusY;
    const dz = Math.abs(z + 0.5 - centerZ) / radiusZ;

    return dx + dy + dz <= 1;
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    void context;
    void event;
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
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
          if (this.isInsideShape(x, y, z, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ)) {
            context.previewFrame.set(x, y, z, previewValue);
          }
        }
      }
    }

    context.projectManager.chunkManager.setPreview(context.previewFrame);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    context.previewFrame.clear();

    if (this.fillShape === "Rect") {
      context.projectManager.applyOptimisticRectEdit(
        context.selectedObject,
        context.mode,
        event.startGridPosition.clone(),
        event.currentGridPosition.clone(),
        context.selectedBlock,
        0
      );

      context.reducers.modifyBlockRect(
        context.projectId,
        context.mode,
        context.selectedBlock,
        event.startGridPosition,
        event.currentGridPosition,
        0,
        context.selectedObject
      );
    } else if (this.fillShape === "Sphere") {
      context.reducers.modifyBlockSphere(
        context.projectId,
        context.mode,
        context.selectedBlock,
        event.startGridPosition,
        event.currentGridPosition,
        0,
        context.selectedObject
      );
    } else {
      context.reducers.modifyBlockRect(
        context.projectId,
        context.mode,
        context.selectedBlock,
        event.startGridPosition,
        event.currentGridPosition,
        0,
        context.selectedObject
      );
    }
  }
}
