import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import type { RectFillShape } from "../tool-options";

export class RectTool implements Tool {
  getType(): ToolType {
    return "Rect";
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

  private isInFillShape(
    fillShape: RectFillShape,
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
    if (fillShape === "Full") {
      return true;
    }

    const centerX = (minX + maxX + 1) / 2;
    const centerY = (minY + maxY + 1) / 2;
    const centerZ = (minZ + maxZ + 1) / 2;
    const radiusX = (maxX - minX + 1) / 2;
    const radiusY = (maxY - minY + 1) / 2;
    const radiusZ = (maxZ - minZ + 1) / 2;
    const sampleX = x + 0.5;
    const sampleY = y + 0.5;
    const sampleZ = z + 0.5;

    if (fillShape === "Sphere") {
      const dx = (sampleX - centerX) / radiusX;
      const dy = (sampleY - centerY) / radiusY;
      const dz = (sampleZ - centerZ) / radiusZ;
      return dx * dx + dy * dy + dz * dz <= 1;
    }

    if (fillShape === "Cylinder") {
      const dx = (sampleX - centerX) / radiusX;
      const dz = (sampleZ - centerZ) / radiusZ;
      return dx * dx + dz * dz <= 1;
    }

    const heightRatio = radiusY === 0 ? 0 : Math.min(1, Math.abs((sampleY - centerY) / radiusY));
    const maxDx = 1 - heightRatio;
    const maxDz = 1 - heightRatio;
    const dx = Math.abs((sampleX - centerX) / radiusX);
    const dz = Math.abs((sampleZ - centerZ) / radiusZ);
    return dx <= maxDx && dz <= maxDz;
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
    const fillShape = context.toolOptions.Rect.fillShape;
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          if (
            this.isInFillShape(
              fillShape,
              x,
              y,
              z,
              bounds.minX,
              bounds.maxX,
              bounds.minY,
              bounds.maxY,
              bounds.minZ,
              bounds.maxZ
            )
          ) {
            context.previewFrame.set(x, y, z, previewValue);
          }
        }
      }
    }

    context.projectManager.chunkManager.setPreview(context.previewFrame);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    context.previewFrame.clear();

    const fillShape = context.toolOptions.Rect.fillShape;
    if (fillShape === "Full") {
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
      return;
    }

    if (fillShape === "Sphere") {
      context.reducers.modifyBlockSphere(
        context.projectId,
        context.mode,
        context.selectedBlock,
        event.startGridPosition,
        event.currentGridPosition,
        0,
        context.selectedObject
      );
      return;
    }

    context.reducers.modifyBlockShape(
      context.projectId,
      context.mode,
      context.selectedBlock,
      event.startGridPosition,
      event.currentGridPosition,
      0,
      context.selectedObject,
      fillShape
    );
  }
}
