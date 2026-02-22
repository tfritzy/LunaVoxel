import * as THREE from "three";
import type { ToolType, SelectShape } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { BLOCK_TYPE_MASK } from "../voxel-constants";
import { VoxelFrame } from "../voxel-frame";
import { getBlockAt } from "@/lib/chunk-utils";

function isPointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export class SelectTool implements Tool {
  private selectShape: SelectShape = "Rectangle";
  private lassoPoints: { x: number; y: number }[] = [];

  getType(): ToolType {
    return "Select";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Select Shape",
        values: ["Rectangle", "Circle", "Lasso", "Magic"],
        currentValue: this.selectShape,
      },
    ];
  }

  setOption(name: string, value: string): void {
    if (name === "Select Shape") {
      this.selectShape = value as SelectShape;
    }
  }

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3 {
    return calculateGridPositionWithMode(gridPosition, normal, "under");
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    if (this.selectShape === "Lasso") {
      this.lassoPoints = [{ x: event.mousePosition.x, y: event.mousePosition.y }];
    }
    void context;
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    if (this.selectShape === "Lasso") {
      this.lassoPoints.push({
        x: event.currentMousePosition.x,
        y: event.currentMousePosition.y,
      });
    }
    void context;
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    const obj = getActiveObject(context);
    if (!obj) return;

    switch (this.selectShape) {
      case "Magic":
        context.reducers.magicSelect(
          context.projectId,
          obj.id,
          event.currentGridPosition
        );
        break;
      case "Rectangle":
        this.selectByScreenRect(context, obj.id, event);
        break;
      case "Circle":
        this.selectByScreenCircle(context, obj.id, event);
        break;
      case "Lasso":
        this.lassoPoints.push({
          x: event.currentMousePosition.x,
          y: event.currentMousePosition.y,
        });
        this.selectByScreenLasso(context, obj.id);
        this.lassoPoints = [];
        break;
    }
  }

  private selectVoxelsByScreenTest(
    context: ToolContext,
    objectId: string,
    testFn: (screenX: number, screenY: number) => boolean
  ): void {
    const obj = getActiveObject(context);
    if (!obj) return;

    const chunks = context.stateStore.getState().chunks;
    const dims = obj.dimensions;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const selected: { x: number; y: number; z: number }[] = [];

    const worldPos = new THREE.Vector3();

    for (let x = 0; x < dims.x; x++) {
      for (let y = 0; y < dims.y; y++) {
        for (let z = 0; z < dims.z; z++) {
          const block = getBlockAt(chunks, objectId, x, y, z);
          if ((block & BLOCK_TYPE_MASK) === 0) continue;

          worldPos.set(x + 0.5, y + 0.5, z + 0.5);
          worldPos.project(context.camera);

          if (worldPos.z < -1 || worldPos.z > 1) continue;

          if (testFn(worldPos.x, worldPos.y)) {
            selected.push({ x, y, z });
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
          }
        }
      }
    }

    if (selected.length === 0) {
      context.reducers.setVoxelSelection(objectId, null);
      return;
    }

    const sdx = maxX - minX + 1;
    const sdy = maxY - minY + 1;
    const sdz = maxZ - minZ + 1;
    const frameData = new Uint8Array(sdx * sdy * sdz);
    for (const { x, y, z } of selected) {
      frameData[(x - minX) * sdy * sdz + (y - minY) * sdz + (z - minZ)] = 1;
    }

    const frame = new VoxelFrame(
      { x: sdx, y: sdy, z: sdz },
      { x: minX, y: minY, z: minZ },
      frameData
    );
    context.reducers.setVoxelSelection(objectId, frame);
  }

  private selectByScreenRect(context: ToolContext, objectId: string, event: ToolDragEvent): void {
    const x1 = Math.min(event.startMousePosition.x, event.currentMousePosition.x);
    const x2 = Math.max(event.startMousePosition.x, event.currentMousePosition.x);
    const y1 = Math.min(event.startMousePosition.y, event.currentMousePosition.y);
    const y2 = Math.max(event.startMousePosition.y, event.currentMousePosition.y);

    this.selectVoxelsByScreenTest(context, objectId, (sx, sy) =>
      sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2
    );
  }

  private selectByScreenCircle(context: ToolContext, objectId: string, event: ToolDragEvent): void {
    const cx = (event.startMousePosition.x + event.currentMousePosition.x) / 2;
    const cy = (event.startMousePosition.y + event.currentMousePosition.y) / 2;
    const dx = event.currentMousePosition.x - event.startMousePosition.x;
    const dy = event.currentMousePosition.y - event.startMousePosition.y;
    const radius = Math.sqrt(dx * dx + dy * dy) / 2;

    this.selectVoxelsByScreenTest(context, objectId, (sx, sy) => {
      const ddx = sx - cx;
      const ddy = sy - cy;
      return ddx * ddx + ddy * ddy <= radius * radius;
    });
  }

  private selectByScreenLasso(context: ToolContext, objectId: string): void {
    if (this.lassoPoints.length < 3) return;
    const polygon = this.lassoPoints;

    this.selectVoxelsByScreenTest(context, objectId, (sx, sy) =>
      isPointInPolygon(sx, sy, polygon)
    );
  }
}
