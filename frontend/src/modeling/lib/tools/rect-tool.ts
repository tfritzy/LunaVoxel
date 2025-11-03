import * as THREE from "three";
import { ToolType } from "../../../module_bindings";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext } from "../tool-interface";
import { floorVector3 } from "./tool-utils";
import type { BuildMode } from "../build-mode";

export abstract class RectTool implements Tool {
  abstract getType(): ToolType;

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode: BuildMode
  ): THREE.Vector3 {
    const multiplier = mode === "Attach" ? 0.1 : -0.1;
    const adjustedPoint = intersectionPoint
      .clone()
      .add(normal.clone().multiplyScalar(multiplier));
    return floorVector3(adjustedPoint);
  }

  onMouseDown(): void {}

  onDrag(
    context: ToolContext,
    startPos: THREE.Vector3,
    currentPos: THREE.Vector3
  ): void {
    context.previewFrame.clear();
    const bounds = calculateRectBounds(startPos, currentPos, context.dimensions);

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          context.previewFrame.set(x, y, z, context.selectedBlock);
        }
      }
    }

    context.projectManager.onPreviewUpdate();
  }

  onMouseUp(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    context.previewFrame.clear();
    
    const toolType = this.getModeBasedToolType(context.mode);
    
    context.projectManager.applyOptimisticRectEdit(
      context.selectedLayer,
      toolType,
      startPos.clone(),
      endPos.clone(),
      context.selectedBlock,
      0
    );

    context.dbConn.reducers.modifyBlockRect(
      context.projectId,
      toolType,
      context.selectedBlock,
      startPos,
      endPos,
      0,
      context.selectedLayer
    );
  }

  private getModeBasedToolType(mode: BuildMode): ToolType {
    switch (mode) {
      case "Attach":
        return { tag: "Build" };
      case "Erase":
        return { tag: "Erase" };
      case "Paint":
        return { tag: "Paint" };
    }
  }
}
