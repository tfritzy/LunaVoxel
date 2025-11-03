import * as THREE from "three";
import { ToolType, type BlockModificationMode } from "../../../module_bindings";
import type { Tool, ToolContext } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class MagicSelectTool implements Tool {
  getType(): ToolType {
    return { tag: "MagicSelect" };
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
    context.dbConn.reducers.magicSelect(
      context.projectId,
      context.selectedLayer,
      endPos
    );
  }
}
