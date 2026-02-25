import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { VoxelFrame } from "../voxel-frame";

export class SprayPaintTool implements Tool {
  private size: number = 5;
  private density: number = 50;
  private lastAppliedPosition: THREE.Vector3 | null = null;
  private isStrokeActive: boolean = false;
  private strokeMode: BlockModificationMode | null = null;
  private strokeSelectedBlock: number = 0;
  private strokeSelectedObjectId: string = "";
  private lastGridPos: THREE.Vector3 | null = null;

  getType(): ToolType {
    return "SprayPaint";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Size",
        values: [],
        currentValue: String(this.size),
        type: "slider",
        min: 1,
        max: 20,
      },
      {
        name: "Density",
        values: [],
        currentValue: String(this.density),
        type: "slider",
        min: 1,
        max: 100,
      },
    ];
  }

  setOption(name: string, value: string): void {
    if (name === "Size") {
      this.size = parseInt(value, 10);
    } else if (name === "Density") {
      this.density = parseInt(value, 10);
    }
  }

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3,
    mode: BlockModificationMode
  ): THREE.Vector3 {
    const direction = mode.tag === "Attach" ? "above" : "under";
    return calculateGridPositionWithMode(gridPosition, normal, direction);
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

  private stampAtPosition(context: ToolContext, center: THREE.Vector3): void {
    const obj = getActiveObject(context);
    if (!obj) return;
    const dims = obj.dimensions;
    const r = this.size;
    const densityFactor = this.density / 100;

    const minX = Math.max(0, Math.floor(center.x - r));
    const minY = Math.max(0, Math.floor(center.y - r));
    const minZ = Math.max(0, Math.floor(center.z - r));
    const maxX = Math.min(dims.x - 1, Math.ceil(center.x + r));
    const maxY = Math.min(dims.y - 1, Math.ceil(center.y + r));
    const maxZ = Math.min(dims.z - 1, Math.ceil(center.z + r));

    const blockValue = this.getBlockValue(context.mode, context.selectedBlock);
    const dimY = dims.y;
    const dimZ = dims.z;
    const r2 = r * r;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const dx = x - center.x;
          const dy = y - center.y;
          const dz = z - center.z;
          if (dx * dx + dy * dy + dz * dz <= r2) {
            if (Math.random() < densityFactor) {
              context.previewBuffer[x * dimY * dimZ + y * dimZ + z] = blockValue;
            }
          }
        }
      }
    }

    context.projectManager.chunkManager.updatePreview(minX, minY, minZ, maxX, maxY, maxZ);
  }

  private ndcToPixel(ndcX: number, ndcY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
    return {
      x: ((ndcX + 1) / 2) * canvas.width,
      y: ((1 - ndcY) / 2) * canvas.height,
    };
  }

  private computeScreenRadius(context: ToolContext, worldCenter: THREE.Vector3, canvas: HTMLCanvasElement): number {
    const centerNdc = worldCenter.clone().project(context.camera);
    const offsetWorld = worldCenter.clone().add(new THREE.Vector3(this.size, 0, 0));
    const offsetNdc = offsetWorld.clone().project(context.camera);
    const dx = ((offsetNdc.x - centerNdc.x) * canvas.width) / 2;
    const dy = ((offsetNdc.y - centerNdc.y) * canvas.height) / 2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private drawBrushCircle(context: ToolContext, mousePos: THREE.Vector2): void {
    const canvas = context.overlayCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const center = this.ndcToPixel(mousePos.x, mousePos.y, canvas);

    let radiusPx: number;
    if (this.lastGridPos) {
      radiusPx = this.computeScreenRadius(context, this.lastGridPos, canvas);
    } else {
      radiusPx = this.size * (canvas.height / 64);
    }

    radiusPx = Math.max(2, radiusPx);

    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private clearOverlay(context: ToolContext): void {
    const canvas = context.overlayCanvas;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  onMouseMove(context: ToolContext, mousePos: THREE.Vector2): void {
    this.drawBrushCircle(context, mousePos);
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    this.isStrokeActive = true;
    this.strokeMode = context.mode;
    this.strokeSelectedBlock = context.selectedBlock;
    this.strokeSelectedObjectId = getActiveObject(context)?.id ?? "";
    this.lastAppliedPosition = event.gridPosition.clone();
    this.lastGridPos = event.gridPosition.clone();

    this.stampAtPosition(context, event.gridPosition);
    this.drawBrushCircle(context, event.mousePosition);
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    this.lastGridPos = event.currentGridPosition.clone();
    this.drawBrushCircle(context, event.currentMousePosition);

    if (
      this.lastAppliedPosition &&
      this.lastAppliedPosition.equals(event.currentGridPosition)
    ) {
      return;
    }

    this.lastAppliedPosition = event.currentGridPosition.clone();
    this.stampAtPosition(context, event.currentGridPosition);
  }

  onMouseUp(context: ToolContext, _event: ToolDragEvent): void {
    if (this.isStrokeActive && this.strokeMode !== null) {
      const obj = getActiveObject(context);
      if (obj) {
        const dims = obj.dimensions;
        const frame = new VoxelFrame(dims, { x: 0, y: 0, z: 0 }, new Uint8Array(context.previewBuffer));
        context.reducers.applyFrame(
          this.strokeMode,
          this.strokeSelectedBlock,
          frame,
          this.strokeSelectedObjectId
        );
        context.previewBuffer.fill(0);
        context.projectManager.chunkManager.clearPreview();
      }
    }

    this.lastAppliedPosition = null;
    this.isStrokeActive = false;
    this.strokeMode = null;
  }

  dispose(): void {
    this.lastGridPos = null;
  }
}
