import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext } from "../tool-interface";
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

  onMouseDown(): void {}

  onDrag(): void {}

  onMouseUp(
    context: ToolContext,
    _startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    const blockType = context.projectManager.getBlockAtPosition(
      endPos,
      context.selectedLayer
    );
    console.log("Picked", blockType);
    if (blockType !== null && blockType !== 0) {
      context.setSelectedBlockInParent(blockType);
    }
  }
}
