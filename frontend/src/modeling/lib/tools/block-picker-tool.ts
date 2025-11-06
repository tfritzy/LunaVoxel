import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { BlockModificationMode } from "@/module_bindings";

export class BlockPickerTool implements Tool {
  getType(): ToolType {
    return "BlockPicker";
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3 {
    return calculateGridPositionWithMode(intersectionPoint, normal, 'under');
  }

  onMouseDown(_context: ToolContext, _event: ToolMouseEvent): void {}

  onDrag(_context: ToolContext, _event: ToolDragEvent): void {}

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
