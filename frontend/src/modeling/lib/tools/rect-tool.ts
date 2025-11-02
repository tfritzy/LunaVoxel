import * as THREE from "three";
import { ToolType } from "../../../module_bindings";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext } from "../tool-interface";
import { floorVector3 } from "./tool-utils";

/**
 * Base class for tools that modify blocks in rectangular regions
 */
export abstract class RectTool implements Tool {
  abstract getType(): ToolType;

  /**
   * Get the normal multiplier for calculating grid position
   * Build tools use positive (0.1), others use negative (-0.1)
   */
  protected abstract getNormalMultiplier(): number;

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3 {
    const adjustedPoint = intersectionPoint
      .clone()
      .add(normal.clone().multiplyScalar(this.getNormalMultiplier()));
    return floorVector3(adjustedPoint);
  }

  onMouseDown(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ToolContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    position: THREE.Vector3
  ): void {
    // RectTool doesn't need to do anything on mouse down
  }

  onDrag(
    context: ToolContext,
    startPos: THREE.Vector3,
    currentPos: THREE.Vector3
  ): void {
    // Show preview during drag
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
    // Clear preview and apply the actual edit
    context.previewFrame.clear();
    context.projectManager.applyOptimisticRectEdit(
      context.selectedLayer,
      this.getType(),
      startPos.clone(),
      endPos.clone(),
      context.selectedBlock,
      0
    );

    context.dbConn.reducers.modifyBlockRect(
      context.projectId,
      this.getType(),
      context.selectedBlock,
      startPos,
      endPos,
      0,
      context.selectedLayer
    );
  }
}
