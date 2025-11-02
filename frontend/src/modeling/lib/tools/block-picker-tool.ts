import * as THREE from "three";
import { ToolType } from "../../../module_bindings";
import type { Tool, ToolContext } from "../tool-interface";
import { floorVector3 } from "./tool-utils";

export class BlockPickerTool implements Tool {
  getType(): ToolType {
    return { tag: "BlockPicker" };
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3 {
    // Block picker targets existing blocks, so we go against the normal
    const adjustedPoint = intersectionPoint.clone().add(normal.clone().multiplyScalar(-0.1));
    return floorVector3(adjustedPoint);
  }

  shouldShowPreview(): boolean {
    // Block picker doesn't show a preview
    return false;
  }

  preview(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ToolContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    startPos: THREE.Vector3,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    endPos: THREE.Vector3
  ): void {
    // Block picker doesn't show preview
  }

  execute(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    // Block picker selects the block at the clicked position
    const blockType = context.projectManager.getBlockAtPosition(
      endPos,
      context.selectedLayer
    );
    if (blockType !== null && blockType !== 0) {
      context.setSelectedBlockInParent(blockType);
    }
  }
}
