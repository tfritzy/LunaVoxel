import * as THREE from "three";
import { ToolType, type BlockModificationMode } from "../../../module_bindings";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class RectTool implements Tool {
  getType(): ToolType {
    return { tag: "Build" };
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
    
    const toolType = this.getModeBasedToolType(context.mode);
    
    context.projectManager.applyOptimisticRectEdit(
      context.selectedLayer,
      toolType,
      startPos.clone(),
      endPos.clone(),
      context.selectedBlock,
      0
    );

    context.dbConn.reducers.modifyBlockRect(
      context.projectId,
      toolType,
      context.selectedBlock,
      startPos,
      endPos,
      0,
      context.selectedLayer
    );
  }

  private getModeBasedToolType(mode: BlockModificationMode): ToolType {
    switch (mode.tag) {
      case "Attach":
        return { tag: "Build" };
      case "Erase":
        return { tag: "Erase" };
      case "Paint":
        return { tag: "Paint" };
    }
  }
}
