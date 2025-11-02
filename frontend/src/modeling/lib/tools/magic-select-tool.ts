import * as THREE from "three";
import { ToolType } from "../../../module_bindings";
import type { Tool, ToolContext } from "../tool-interface";

export class MagicSelectTool implements Tool {
  getType(): ToolType {
    return { tag: "MagicSelect" };
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3 {
    // Magic select targets existing blocks, so we go against the normal
    const adjustedPoint = intersectionPoint.add(normal.multiplyScalar(-0.1));
    return this.floorVector3(adjustedPoint);
  }

  shouldShowPreview(): boolean {
    return true;
  }

  preview(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ToolContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    startPos: THREE.Vector3,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    endPos: THREE.Vector3
  ): void {
    // Magic select doesn't show a preview during drag
  }

  execute(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    // Magic select calls a special reducer
    context.dbConn.reducers.magicSelect(
      context.projectId,
      context.selectedLayer,
      endPos
    );
  }

  private floorVector3(vector3: THREE.Vector3): THREE.Vector3 {
    vector3.x = Math.floor(vector3.x);
    vector3.y = Math.floor(vector3.y);
    vector3.z = Math.floor(vector3.z);
    return vector3;
  }
}
