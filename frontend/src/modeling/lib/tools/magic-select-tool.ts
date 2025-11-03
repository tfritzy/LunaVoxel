import * as THREE from "three";
import { ToolType } from "../../../module_bindings";
import type { Tool, ToolContext } from "../tool-interface";
import { floorVector3 } from "./tool-utils";

export class MagicSelectTool implements Tool {
  getType(): ToolType {
    return { tag: "MagicSelect" };
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
    context.dbConn.reducers.magicSelect(
      context.projectId,
      context.selectedLayer,
      endPos
    );
  }
}
