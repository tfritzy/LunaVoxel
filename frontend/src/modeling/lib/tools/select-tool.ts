import * as THREE from "three";
import type { ToolType, SelectShape } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { BLOCK_TYPE_MASK } from "../voxel-constants";
import { VoxelFrame } from "../voxel-frame";
import { getBlockAt } from "@/lib/chunk-utils";

function mergeVoxelFrames(a: VoxelFrame, b: VoxelFrame): VoxelFrame {
  const aMin = a.getMinPos();
  const aDims = a.getDimensions();
  const bMin = b.getMinPos();
  const bDims = b.getDimensions();

  const minX = Math.min(aMin.x, bMin.x);
  const minY = Math.min(aMin.y, bMin.y);
  const minZ = Math.min(aMin.z, bMin.z);
  const maxX = Math.max(aMin.x + aDims.x, bMin.x + bDims.x);
  const maxY = Math.max(aMin.y + aDims.y, bMin.y + bDims.y);
  const maxZ = Math.max(aMin.z + aDims.z, bMin.z + bDims.z);

  const sdx = maxX - minX;
  const sdy = maxY - minY;
  const sdz = maxZ - minZ;
  const frameData = new Uint8Array(sdx * sdy * sdz);

  for (let x = aMin.x; x < aMin.x + aDims.x; x++) {
    for (let y = aMin.y; y < aMin.y + aDims.y; y++) {
      for (let z = aMin.z; z < aMin.z + aDims.z; z++) {
        if (a.get(x, y, z) !== 0) {
          frameData[(x - minX) * sdy * sdz + (y - minY) * sdz + (z - minZ)] = 1;
        }
      }
    }
  }

  for (let x = bMin.x; x < bMin.x + bDims.x; x++) {
    for (let y = bMin.y; y < bMin.y + bDims.y; y++) {
      for (let z = bMin.z; z < bMin.z + bDims.z; z++) {
        if (b.get(x, y, z) !== 0) {
          frameData[(x - minX) * sdy * sdz + (y - minY) * sdz + (z - minZ)] = 1;
        }
      }
    }
  }

  return new VoxelFrame({ x: sdx, y: sdy, z: sdz }, { x: minX, y: minY, z: minZ }, frameData);
}

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
    this.renderOverlay(context, event, event.shiftKey);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    this.clearOverlay(context);

    const obj = getActiveObject(context);
    if (!obj) return;

    switch (this.selectShape) {
      case "Magic": {
        if (event.shiftKey) {
          const before = context.stateStore.getState().voxelSelection;
          context.reducers.magicSelect(
            context.projectId,
            obj.id,
            event.currentGridPosition
          );
          const after = context.stateStore.getState().voxelSelection;
          if (before && after) {
            context.reducers.setVoxelSelection(obj.id, mergeVoxelFrames(before, after));
          } else if (before && !after) {
            context.reducers.setVoxelSelection(obj.id, before);
          }
        } else {
          context.reducers.magicSelect(
            context.projectId,
            obj.id,
            event.currentGridPosition
          );
        }
        break;
      }
      case "Rectangle":
        this.selectByScreenRect(context, obj.id, event, event.shiftKey);
        break;
      case "Circle":
        this.selectByScreenCircle(context, obj.id, event, event.shiftKey);
        break;
      case "Lasso":
        this.lassoPoints.push({
          x: event.currentMousePosition.x,
          y: event.currentMousePosition.y,
        });
        this.selectByScreenLasso(context, obj.id, event.shiftKey);
        this.lassoPoints = [];
        break;
    }
  }

  dispose(): void {
    this.lassoPoints = [];
  }

  private selectVoxelsByScreenTest(
    context: ToolContext,
    objectId: string,
    testFn: (screenX: number, screenY: number) => boolean,
    append?: boolean
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
      if (!append) {
        context.reducers.setVoxelSelection(objectId, null);
      }
      return;
    }

    const sdx = maxX - minX + 1;
    const sdy = maxY - minY + 1;
    const sdz = maxZ - minZ + 1;
    const frameData = new Uint8Array(sdx * sdy * sdz);
    for (const { x, y, z } of selected) {
      frameData[(x - minX) * sdy * sdz + (y - minY) * sdz + (z - minZ)] = 1;
    }

    const newFrame = new VoxelFrame(
      { x: sdx, y: sdy, z: sdz },
      { x: minX, y: minY, z: minZ },
      frameData
    );

    const existing = append ? context.stateStore.getState().voxelSelection : null;
    const frame = existing ? mergeVoxelFrames(existing, newFrame) : newFrame;

    context.reducers.setVoxelSelection(objectId, frame);
  }

  private selectByScreenRect(context: ToolContext, objectId: string, event: ToolDragEvent, shiftKey?: boolean): void {
    let dx = event.currentMousePosition.x - event.startMousePosition.x;
    let dy = event.currentMousePosition.y - event.startMousePosition.y;

    if (shiftKey) {
      const side = Math.min(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx) * side;
      dy = Math.sign(dy) * side;
    }

    const x1 = Math.min(event.startMousePosition.x, event.startMousePosition.x + dx);
    const x2 = Math.max(event.startMousePosition.x, event.startMousePosition.x + dx);
    const y1 = Math.min(event.startMousePosition.y, event.startMousePosition.y + dy);
    const y2 = Math.max(event.startMousePosition.y, event.startMousePosition.y + dy);

    this.selectVoxelsByScreenTest(context, objectId, (sx, sy) =>
      sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2,
      shiftKey
    );
  }

  private selectByScreenCircle(context: ToolContext, objectId: string, event: ToolDragEvent, shiftKey?: boolean): void {
    let dx = event.currentMousePosition.x - event.startMousePosition.x;
    let dy = event.currentMousePosition.y - event.startMousePosition.y;

    if (shiftKey) {
      const side = Math.min(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx) * side;
      dy = Math.sign(dy) * side;
    }

    const cx = event.startMousePosition.x + dx / 2;
    const cy = event.startMousePosition.y + dy / 2;
    const rx = Math.abs(dx) / 2;
    const ry = Math.abs(dy) / 2;

    if (!(rx > 0 && ry > 0)) return;

    this.selectVoxelsByScreenTest(context, objectId, (sx, sy) => {
      const nx = (sx - cx) / rx;
      const ny = (sy - cy) / ry;
      return nx * nx + ny * ny <= 1;
    }, shiftKey);
  }

  private selectByScreenLasso(context: ToolContext, objectId: string, shiftKey?: boolean): void {
    if (this.lassoPoints.length < 3) return;
    const polygon = this.lassoPoints;

    this.selectVoxelsByScreenTest(context, objectId, (sx, sy) =>
      isPointInPolygon(sx, sy, polygon),
      shiftKey
    );
  }

  private ndcToPixel(ndcX: number, ndcY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
    return {
      x: (ndcX + 1) / 2 * canvas.width,
      y: (1 - ndcY) / 2 * canvas.height,
    };
  }

  private renderOverlay(context: ToolContext, event: ToolDragEvent, shiftKey?: boolean): void {
    const canvas = context.overlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;

    switch (this.selectShape) {
      case "Rectangle": {
        const start = this.ndcToPixel(event.startMousePosition.x, event.startMousePosition.y, canvas);
        const end = this.ndcToPixel(event.currentMousePosition.x, event.currentMousePosition.y, canvas);
        let w = end.x - start.x;
        let h = end.y - start.y;
        if (shiftKey) {
          const side = Math.min(Math.abs(w), Math.abs(h));
          w = Math.sign(w) * side;
          h = Math.sign(h) * side;
        }
        const x = Math.min(start.x, start.x + w);
        const y = Math.min(start.y, start.y + h);
        ctx.strokeRect(x, y, Math.abs(w), Math.abs(h));
        break;
      }
      case "Circle": {
        const start = this.ndcToPixel(event.startMousePosition.x, event.startMousePosition.y, canvas);
        const end = this.ndcToPixel(event.currentMousePosition.x, event.currentMousePosition.y, canvas);
        let w = end.x - start.x;
        let h = end.y - start.y;
        if (shiftKey) {
          const side = Math.min(Math.abs(w), Math.abs(h));
          w = Math.sign(w) * side;
          h = Math.sign(h) * side;
        }
        const cx = start.x + w / 2;
        const cy = start.y + h / 2;
        const rx = Math.abs(w) / 2;
        const ry = Math.abs(h) / 2;
        if (rx > 0 && ry > 0) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case "Lasso": {
        if (this.lassoPoints.length < 2) break;
        ctx.beginPath();
        const first = this.ndcToPixel(this.lassoPoints[0].x, this.lassoPoints[0].y, canvas);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
          const pt = this.ndcToPixel(this.lassoPoints[i].x, this.lassoPoints[i].y, canvas);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        break;
      }
    }
  }

  private clearOverlay(context: ToolContext): void {
    const canvas = context.overlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
