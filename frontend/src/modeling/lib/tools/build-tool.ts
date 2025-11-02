import * as THREE from "three";
import { ToolType } from "../../../module_bindings";
import { calculateRectBounds } from "@/lib/rect-utils";
import type { Tool, ToolContext } from "../tool-interface";

export class BuildTool implements Tool {
  getType(): ToolType {
    return { tag: "Build" };
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3 {
    // Build tool places blocks in the direction of the normal
    const adjustedPoint = intersectionPoint.add(normal.multiplyScalar(0.1));
    return this.floorVector3(adjustedPoint);
  }

  shouldShowPreview(): boolean {
    return true;
  }

  preview(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    context.previewFrame.clear();
    const bounds = calculateRectBounds(startPos, endPos, context.dimensions);

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          context.previewFrame.set(x, y, z, context.selectedBlock);
        }
      }
    }

    context.projectManager.onPreviewUpdate();
  }

  execute(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
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

  private floorVector3(vector3: THREE.Vector3): THREE.Vector3 {
    vector3.x = Math.floor(vector3.x);
    vector3.y = Math.floor(vector3.y);
    vector3.z = Math.floor(vector3.z);
    return vector3;
  }
}
