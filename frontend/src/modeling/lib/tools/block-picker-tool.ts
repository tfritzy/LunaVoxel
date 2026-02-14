import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import type { BlockModificationMode } from "@/state/types";
import { BLOCK_TYPE_MASK } from "../voxel-constants";

export class BlockPickerTool implements Tool {
  getType(): ToolType {
    return "BlockPicker";
  }

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3 {
    void mode;
    return calculateGridPositionWithMode(gridPosition, normal, 'under');
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
      context.selectedObject
    );
    if (blockType !== null && blockType !== 0) {
      context.setSelectedBlockInParent(blockType & BLOCK_TYPE_MASK);
    }
  }
}
