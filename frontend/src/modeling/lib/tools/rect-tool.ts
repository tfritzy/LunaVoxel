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
    
    context.previewOctree.clear();

    if (context.mode.tag === "Attach") {
      context.previewOctree.setRegion(frameMinPos, frameSize, context.selectedBlock);
    } else {
      const position = new THREE.Vector3();
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
          for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
            position.set(x, y, z);
            const current = context.projectManager.getBlockAtPosition(
              position,
              context.selectedLayer
            );
            if (current && current > 0) {
              const previewValue =
                context.mode.tag === "Paint" ? context.selectedBlock : current;
              context.previewOctree.set(x, y, z, previewValue);
            }
          }
        }
      }
    }

    context.projectManager.octreeManager.setPreview(context.previewOctree);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    context.previewOctree.clear();
    context.projectManager.octreeManager.setPreview(context.previewOctree);
    
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
