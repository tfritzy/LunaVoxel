import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class MagicSelectTool implements Tool {
  getType(): ToolType {
    return "MagicSelect";
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3 {
    return calculateGridPositionWithMode(intersectionPoint, normal, "under");
  }

  onMouseDown(_context: ToolContext, _event: ToolMouseEvent): void {}

  onDrag(_context: ToolContext, _event: ToolDragEvent): void {}

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    context.reducers.magicSelect(
      context.selectedLayer,
      event.currentGridPosition
    );
  }
}
