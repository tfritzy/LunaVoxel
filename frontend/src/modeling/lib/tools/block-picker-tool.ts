import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import type { BlockModificationMode } from "@/state/types";
import { stateStore } from "@/state/store";

export class BlockPickerTool implements Tool {
  getType(): ToolType {
    return "BlockPicker";
  }

  getOptions(): ToolOption[] {
    return [];
  }

  setOption(): void {}

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
    const blockCount = stateStore.getState().blocks.colors.length;
    if (blockType !== null && blockType > 0 && blockType <= blockCount) {
      context.setSelectedBlockInParent(blockType);
    }
  }
}
