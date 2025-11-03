import * as THREE from "three";
import type { BlockModificationMode } from "../../../module_bindings";
import type { ToolType } from "../tool-type";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class RectTool implements Tool {
  getType(): ToolType {
    return { tag: "Rect" };
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode: BlockModificationMode
  ): THREE.Vector3 {
    return calculateGridPositionWithMode(intersectionPoint, normal, mode);
  }

  onMouseDown(): void {}

  onDrag(
    context: ToolContext,
    startPos: THREE.Vector3,
    currentPos: THREE.Vector3
  ): void {
    context.previewFrame.clear();
    const bounds = calculateRectBounds(startPos, currentPos, context.dimensions);

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          context.previewFrame.set(x, y, z, context.selectedBlock);
        }
      }
    }

    context.projectManager.onPreviewUpdate();
  }

  onMouseUp(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    context.previewFrame.clear();
    
    context.projectManager.applyOptimisticRectEdit(
      context.selectedLayer,
      context.mode,
      startPos.clone(),
      endPos.clone(),
      context.selectedBlock,
      0
    );

    context.dbConn.reducers.modifyBlockRect(
      context.projectId,
      context.mode,
      context.selectedBlock,
      startPos,
      endPos,
      0,
      context.selectedLayer
    );
  }
}
