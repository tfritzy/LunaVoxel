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
    const adjustedPoint = intersectionPoint.clone().add(normal.clone().multiplyScalar(-0.1));
    return floorVector3(adjustedPoint);
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
