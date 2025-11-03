import * as THREE from "three";
import { ToolType, type BlockModificationMode } from "../../../module_bindings";
import type { Tool, ToolContext } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class BlockPickerTool implements Tool {
  getType(): ToolType {
    return { tag: "BlockPicker" };
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mode: BlockModificationMode
  ): THREE.Vector3 {
    return calculateGridPositionWithMode(intersectionPoint, normal, { tag: "Erase" });
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
    if (blockType !== null && blockType !== 0) {
      context.setSelectedBlockInParent(blockType);
    }
  }
}
