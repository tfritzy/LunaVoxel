import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class RectTool implements Tool {
  getType(): ToolType {
    return "Rect";
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode: BlockModificationMode
  ): THREE.Vector3 {
    const direction = mode.tag === "Attach" ? "above" : "under";
    return calculateGridPositionWithMode(intersectionPoint, normal, direction);
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    void context;
    void event;
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    context.projectManager.octreeManager.setPreviewRect(
      context.mode,
      context.selectedLayer,
      event.startGridPosition,
      event.currentGridPosition,
      context.selectedBlock,
    );
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    context.projectManager.octreeManager.clearPreview();

    context.reducers.modifyBlockRect(
      context.projectId,
      context.mode,
      context.selectedBlock,
      event.startGridPosition,
      event.currentGridPosition,
      0,
      context.selectedLayer
    );
  }
}
