import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import type { BlockModificationMode } from "@/state/types";

export class BlockPickerTool implements Tool {
  getType(): ToolType {
    return "BlockPicker";
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3 {
    void mode;
    return calculateGridPositionWithMode(intersectionPoint, normal, 'under');
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    void context;
    void event;
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    void context;
    void event;
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    const blockType = context.projectManager.getBlockAtPosition(
      event.currentGridPosition,
      context.selectedLayer
    );
    if (blockType !== null && blockType !== 0) {
      context.setSelectedBlockInParent(blockType);
    }
  }
}
