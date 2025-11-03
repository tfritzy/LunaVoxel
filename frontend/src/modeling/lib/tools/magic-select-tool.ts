import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class MagicSelectTool implements Tool {
  getType(): ToolType {
    return { tag: "MagicSelect" };
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3
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
