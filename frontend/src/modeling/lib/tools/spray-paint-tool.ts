import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode, getBlockValue } from "./tool-utils";
import { raycastVoxels } from "../voxel-raycast";
import { VoxelFrame } from "../voxel-frame";

export class SprayPaintTool implements Tool {
  private size: number = 5;
  private density: number = 50;
  private isStrokeActive: boolean = false;
  private strokeMode: BlockModificationMode | null = null;
  private strokeSelectedBlock: number = 0;
  private strokeSelectedObjectId: string = "";
  private lastHitPos: THREE.Vector3 | null = null;
  private lastMousePos: THREE.Vector2 | null = null;

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
    return Math.max(2, Math.sqrt(dx * dx + dy * dy));
  }

  private drawBrushCircle(context: ToolContext, mousePos: THREE.Vector2): void {
    const canvas = context.overlayCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const center = this.ndcToPixel(mousePos.x, mousePos.y, canvas);
    const radiusPx = this.lastHitPos
      ? this.computeScreenRadius(context, this.lastHitPos, canvas)
      : Math.max(2, this.size * (canvas.height / 64));

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

  private sprayAtScreenPos(context: ToolContext, mousePos: THREE.Vector2, hitPos: THREE.Vector3): void {
    const obj = getActiveObject(context);
    if (!obj) return;

    const canvas = context.overlayCanvas;
    const dims = obj.dimensions;
    const dimY = dims.y;
    const dimZ = dims.z;

    const centerPx = this.ndcToPixel(mousePos.x, mousePos.y, canvas);
    const radiusPx = this.computeScreenRadius(context, hitPos, canvas);

    const blockValue = getBlockValue(context.mode, context.selectedBlock);
    const numSamples = Math.max(1, Math.ceil(this.density / 5));

    const raycaster = new THREE.Raycaster();
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < numSamples; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = radiusPx * Math.sqrt(Math.random());
      const px = centerPx.x + Math.cos(angle) * r;
      const py = centerPx.y + Math.sin(angle) * r;

      const ndcX = (px / canvas.width) * 2 - 1;
      const ndcY = 1 - (py / canvas.height) * 2;

      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), context.camera);
      const result = raycastVoxels(
        raycaster.ray.origin,
        raycaster.ray.direction,
        dims,
        context.projectManager.chunkManager.getVoxelAtWorldPos.bind(context.projectManager.chunkManager)
      );

      if (!result) continue;

      let wx = result.gridPosition.x;
      let wy = result.gridPosition.y;
      let wz = result.gridPosition.z;

      if (context.mode.tag === "Attach") {
        wx += result.normal.x;
        wy += result.normal.y;
        wz += result.normal.z;
      }

      if (wx < 0 || wx >= dims.x || wy < 0 || wy >= dims.y || wz < 0 || wz >= dims.z) continue;

      context.previewBuffer[wx * dimY * dimZ + wy * dimZ + wz] = blockValue;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
    }

    if (minX !== Infinity) {
      context.projectManager.chunkManager.updatePreview(minX, minY, minZ, maxX, maxY, maxZ);
    }
  }

  onMouseMove(context: ToolContext, mousePos: THREE.Vector2): void {
    this.lastMousePos = mousePos;
    this.drawBrushCircle(context, mousePos);
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    this.isStrokeActive = true;
    this.strokeMode = context.mode;
    this.strokeSelectedBlock = context.selectedBlock;
    this.strokeSelectedObjectId = getActiveObject(context)?.id ?? "";
    this.lastHitPos = event.gridPosition.clone();
    this.lastMousePos = event.mousePosition.clone();

    this.sprayAtScreenPos(context, event.mousePosition, event.gridPosition);
    this.drawBrushCircle(context, event.mousePosition);
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    this.lastHitPos = event.currentGridPosition.clone();
    this.lastMousePos = event.currentMousePosition.clone();
    this.drawBrushCircle(context, event.currentMousePosition);
    this.sprayAtScreenPos(context, event.currentMousePosition, event.currentGridPosition);
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

    this.isStrokeActive = false;
    this.strokeMode = null;
  }

  dispose(): void {
    this.lastHitPos = null;
    this.lastMousePos = null;
  }
}

