import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getSelectedObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class MagicSelectTool implements Tool {
  getType(): ToolType {
    return "MagicSelect";
  }

  getOptions(): ToolOption[] {
    return [];
  }

  setOption(): void {}

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3 {
    return calculateGridPositionWithMode(gridPosition, normal, "under");
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
    const obj = getSelectedObject(context);
    if (!obj) return;
    context.reducers.magicSelect(
      context.projectId,
      obj.id,
      event.currentGridPosition
    );
  }
}
