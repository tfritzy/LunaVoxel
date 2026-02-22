import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject, getActiveSelectionFrame } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { getBlockType } from "../voxel-data-utils";
import { VoxelFrame } from "../voxel-frame";

const NEIGHBORS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export class FillTool implements Tool {
  getType(): ToolType {
    return "Fill";
  }

  getOptions(): ToolOption[] {
    return [];
  }

  setOption(): void {}

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3 {
    void mode;
    return calculateGridPositionWithMode(gridPosition, normal, "under");
  }

  private getBlockValue(mode: BlockModificationMode, selectedBlock: number): number {
    switch (mode.tag) {
      case "Attach":
        return selectedBlock;
      case "Paint":
        return selectedBlock | RAYCASTABLE_BIT;
      case "Erase":
        return RAYCASTABLE_BIT;
    }
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
    const obj = getActiveObject(context);
    if (!obj) return;

    const pos = event.currentGridPosition;
    const dims = obj.dimensions;

    if (pos.x < 0 || pos.x >= dims.x || pos.y < 0 || pos.y >= dims.y || pos.z < 0 || pos.z >= dims.z) return;

    const clickedBlock = context.projectManager.getBlockAtPosition(pos, obj.id);
    if (clickedBlock === null || clickedBlock === 0) return;

    const targetType = getBlockType(clickedBlock);
    if (targetType === 0) return;

    const blockValue = this.getBlockValue(context.mode, context.selectedBlock);
    const dimY = dims.y;
    const dimZ = dims.z;
    const selectionFrame = getActiveSelectionFrame(context);

    const totalSize = dims.x * dimY * dimZ;
    const visited = new Uint8Array(totalSize);
    const queue: number[] = [];

    const startIndex = pos.x * dimY * dimZ + pos.y * dimZ + pos.z;
    visited[startIndex] = 1;
    queue.push(pos.x, pos.y, pos.z);

    let minX = pos.x, maxX = pos.x;
    let minY = pos.y, maxY = pos.y;
    let minZ = pos.z, maxZ = pos.z;

    const tmpVec = new THREE.Vector3();

    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];

      const index = x * dimY * dimZ + y * dimZ + z;

      if (!selectionFrame || selectionFrame.isSet(x, y, z)) {
        context.previewBuffer[index] = blockValue;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;

      for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) continue;

        const nIndex = nx * dimY * dimZ + ny * dimZ + nz;
        if (visited[nIndex]) continue;
        visited[nIndex] = 1;

        const neighborBlock = context.projectManager.getBlockAtPosition(
          tmpVec.set(nx, ny, nz), obj.id
        );

        if (neighborBlock !== null && getBlockType(neighborBlock) === targetType) {
          queue.push(nx, ny, nz);
        }
      }
    }

    context.projectManager.chunkManager.updatePreview(minX, minY, minZ, maxX, maxY, maxZ);

    const frame = new VoxelFrame(dims, { x: 0, y: 0, z: 0 }, new Uint8Array(context.previewBuffer));
    context.reducers.applyFrame(context.mode, context.selectedBlock, frame, obj.id);
    context.previewBuffer.fill(0);
    context.projectManager.chunkManager.clearPreview();
  }
}
