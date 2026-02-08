import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class RectTool implements Tool {
  getType(): ToolType {
    return "Rect";
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode: BlockModificationMode
  ): THREE.Vector3 {
    const direction = mode.tag === "Attach" ? "above" : "under";
    return calculateGridPositionWithMode(intersectionPoint, normal, direction);
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

    const positions: { x: number; y: number; z: number; value: number }[] = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          positions.push({ x, y, z, value: context.selectedBlock });
        }
      }
    }

    context.projectManager.octreeManager.setPreview(positions);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    context.projectManager.octreeManager.clearPreview();
    
    context.projectManager.applyOptimisticRectEdit(
      context.selectedLayer,
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
      context.selectedLayer
    );
  }
}
