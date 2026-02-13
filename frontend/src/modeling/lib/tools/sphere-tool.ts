import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";

export class SphereTool implements Tool {
  getType(): ToolType {
    return "Sphere";
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
          if (this.isInsideSphere(x, y, z, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ)) {
            context.previewFrame.set(x, y, z, previewValue);
          }
        }
      }
    }

    context.projectManager.chunkManager.setPreview(context.previewFrame);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    context.previewFrame.clear();

    context.reducers.modifyBlockSphere(
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
