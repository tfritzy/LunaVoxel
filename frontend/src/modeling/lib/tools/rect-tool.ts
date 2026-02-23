import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { FillShape, ShapeDirection } from "../tool-type";
import { calculateRectBounds, snapBoundsToEqual } from "@/lib/rect-utils";
import type { RectBounds } from "@/lib/rect-utils";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { isInsideFillShapePrecomputed, precomputeShapeParams } from "../fill-shape-utils";
import { VoxelFrame } from "../voxel-frame";

type ResizeCorner = {
  xSide: "min" | "max";
  ySide: "min" | "max";
  zSide: "min" | "max";
};

export class RectTool implements Tool {
  private fillShape: FillShape = "Rect";
  private direction: ShapeDirection = "+y";
  private adjustBeforeApply = true;
  private pending: {
    bounds: RectBounds;
    mode: BlockModificationMode;
    selectedBlock: number;
    objectId: string;
    fillShape: FillShape;
    direction: ShapeDirection;
  } | null = null;
  private lastBounds: RectBounds | null = null;
  private resizingCorner: ResizeCorner | null = null;
  private resizeBaseBounds: RectBounds | null = null;
  private boundsBoxHelper: THREE.Box3Helper | null = null;
  private handleMeshes: THREE.Mesh[] = [];
  private static readonly HANDLE_SPHERE_GEOMETRY = new THREE.SphereGeometry(0.25, 8, 8);
  private static readonly HANDLE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

  private static readonly HANDLE_SCREEN_THRESHOLD = 0.04;

  getType(): ToolType {
    return "Rect";
  }

  getOptions(): ToolOption[] {
    return [
      {
        name: "Fill Shape",
        values: ["Rect", "Sphere", "Cylinder", "Triangle", "Diamond", "Cone", "Pyramid", "Hexagon"],
        currentValue: this.fillShape,
      },
      {
        name: "Direction",
        values: ["+x", "-x", "+y", "-y", "+z", "-z"],
        currentValue: this.direction,
        type: "direction",
      },
      {
        name: "Adjust Before Apply",
        values: ["true", "false"],
        currentValue: this.adjustBeforeApply ? "true" : "false",
        type: "checkbox",
      },
    ];
  }

  setOption(name: string, value: string): void {
    if (name === "Fill Shape") {
      this.fillShape = value as FillShape;
      if (this.pending) {
        this.pending.fillShape = this.fillShape;
      }
    } else if (name === "Direction") {
      this.direction = value as ShapeDirection;
      if (this.pending) {
        this.pending.direction = this.direction;
      }
    } else if (name === "Adjust Before Apply") {
      this.adjustBeforeApply = value === "true";
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

  private getPreviewBlockValue(mode: BlockModificationMode, selectedBlock: number): number {
    switch (mode.tag) {
      case "Attach":
        return selectedBlock;
      case "Paint":
        return selectedBlock | RAYCASTABLE_BIT;
      case "Erase":
        return RAYCASTABLE_BIT;
    }
  }

  private clearLastBounds(context: ToolContext): void {
    if (!this.lastBounds) return;
    const dims = getActiveObject(context)!.dimensions;
    const dimY = dims.y;
    const dimZ = dims.z;
    const lb = this.lastBounds;
    for (let x = lb.minX; x <= lb.maxX; x++) {
      for (let y = lb.minY; y <= lb.maxY; y++) {
        for (let z = lb.minZ; z <= lb.maxZ; z++) {
          context.previewBuffer[x * dimY * dimZ + y * dimZ + z] = 0;
        }
      }
    }
  }

  private buildFrameFromBounds(context: ToolContext, bounds: RectBounds): void {
    const fillShape = this.pending?.fillShape ?? this.fillShape;
    const direction = this.pending?.direction ?? this.direction;
    const mode = this.pending?.mode ?? context.mode;
    const selectedBlock = this.pending?.selectedBlock ?? context.selectedBlock;

    this.clearLastBounds(context);

    const previewValue = this.getPreviewBlockValue(mode, selectedBlock);
    const dims = getActiveObject(context)!.dimensions;
    const dimY = dims.y;
    const dimZ = dims.z;

    if (fillShape === "Rect") {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
          for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
            context.previewBuffer[x * dimY * dimZ + y * dimZ + z] = previewValue;
          }
        }
      }
    } else {
      let sMinX = bounds.minX, sMaxX = bounds.maxX;
      let sMinY = bounds.minY, sMaxY = bounds.maxY;
      let sMinZ = bounds.minZ, sMaxZ = bounds.maxZ;
      const yFlip = direction === "-y" ? bounds.minY + bounds.maxY : 0;
      const xFlip = direction === "-x" ? bounds.minX + bounds.maxX : 0;
      const zFlip = direction === "-z" ? bounds.minZ + bounds.maxZ : 0;

      switch (direction) {
        case "+x":
        case "-x":
          sMinX = bounds.minY; sMaxX = bounds.maxY;
          sMinY = bounds.minX; sMaxY = bounds.maxX;
          break;
        case "+z":
        case "-z":
          sMinZ = bounds.minY; sMaxZ = bounds.maxY;
          sMinY = bounds.minZ; sMaxY = bounds.maxZ;
          break;
      }

      const shapeParams = precomputeShapeParams(sMinX, sMaxX, sMinY, sMaxY, sMinZ, sMaxZ);

      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
          for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
            let sx = x, sy = y, sz = z;

            switch (direction) {
              case "-y":
                sy = yFlip - y;
                break;
              case "+x":
                sx = y; sy = x;
                break;
              case "-x":
                sx = y; sy = xFlip - x;
                break;
              case "+z":
                sz = y; sy = z;
                break;
              case "-z":
                sz = y; sy = zFlip - z;
                break;
            }

            if (isInsideFillShapePrecomputed(fillShape, sx, sy, sz, shapeParams)) {
              context.previewBuffer[x * dimY * dimZ + y * dimZ + z] = previewValue;
            }
          }
        }
      }
    }

    const updateMinX = this.lastBounds
      ? Math.min(bounds.minX, this.lastBounds.minX)
      : bounds.minX;
    const updateMinY = this.lastBounds
      ? Math.min(bounds.minY, this.lastBounds.minY)
      : bounds.minY;
    const updateMinZ = this.lastBounds
      ? Math.min(bounds.minZ, this.lastBounds.minZ)
      : bounds.minZ;
    const updateMaxX = this.lastBounds
      ? Math.max(bounds.maxX, this.lastBounds.maxX)
      : bounds.maxX;
    const updateMaxY = this.lastBounds
      ? Math.max(bounds.maxY, this.lastBounds.maxY)
      : bounds.maxY;
    const updateMaxZ = this.lastBounds
      ? Math.max(bounds.maxZ, this.lastBounds.maxZ)
      : bounds.maxZ;

    this.lastBounds = { ...bounds };
    context.projectManager.chunkManager.updatePreview(
      updateMinX, updateMinY, updateMinZ,
      updateMaxX, updateMaxY, updateMaxZ
    );
  }

  private buildFrame(context: ToolContext, event: ToolDragEvent): RectBounds {
    let bounds = calculateRectBounds(
      event.startGridPosition,
      event.currentGridPosition,
      getActiveObject(context)!.dimensions
    );
    if (event.shiftKey) {
      bounds = snapBoundsToEqual(bounds, event.startGridPosition);
    }
    this.buildFrameFromBounds(context, bounds);
    return bounds;
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    void context;
    void event;
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    const bounds = this.buildFrame(context, event);
    this.renderBoundsBox(context, bounds);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    let bounds = calculateRectBounds(
      event.startGridPosition,
      event.currentGridPosition,
      getActiveObject(context)!.dimensions
    );
    if (event.shiftKey) {
      bounds = snapBoundsToEqual(bounds, event.startGridPosition);
    }
    this.buildFrameFromBounds(context, bounds);

    if (!this.adjustBeforeApply) {
      this.applyAndClear(context, bounds);
      this.pending = null;
      this.clearBoundsBox(context);
      return;
    }

    this.pending = {
      bounds,
      mode: context.mode,
      selectedBlock: context.selectedBlock,
      objectId: getActiveObject(context)?.id ?? "",
      fillShape: this.fillShape,
      direction: this.direction,
    };

    this.updateBoundsBox(context);
  }

  hasPendingOperation(): boolean {
    return this.pending !== null;
  }

  getPendingBounds(): RectBounds | null {
    if (!this.pending) return null;
    return { ...this.pending.bounds };
  }

  onPendingMouseDown(context: ToolContext, mousePos: THREE.Vector2): boolean {
    if (!this.pending) return false;

    const corner = this.findResizeHandle(context, mousePos);
    if (corner) {
      this.resizingCorner = corner;
      this.resizeBaseBounds = { ...this.pending.bounds };
      return true;
    }

    return false;
  }

  onPendingMouseMove(context: ToolContext, mousePos: THREE.Vector2, shiftKey?: boolean): void {
    if (!this.resizingCorner || !this.resizeBaseBounds) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePos, context.camera);
    const ray = raycaster.ray;

    const corner = this.resizingCorner;
    const base = this.resizeBaseBounds;

    const dragX = corner.xSide === "min" ? base.minX : base.maxX;
    const dragY = corner.ySide === "min" ? base.minY : base.maxY;
    const dragZ = corner.zSide === "min" ? base.minZ : base.maxZ;
    const dragCorner = new THREE.Vector3(dragX + 0.5, dragY + 0.5, dragZ + 0.5);

    const viewDir = new THREE.Vector3();
    context.camera.getWorldDirection(viewDir);

    const normal = new THREE.Vector3();
    const absX = Math.abs(viewDir.x);
    const absY = Math.abs(viewDir.y);
    const absZ = Math.abs(viewDir.z);

    if (absX >= absY && absX >= absZ) {
      normal.set(Math.sign(viewDir.x), 0, 0);
    } else if (absY >= absX && absY >= absZ) {
      normal.set(0, Math.sign(viewDir.y), 0);
    } else {
      normal.set(0, 0, Math.sign(viewDir.z));
    }

    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(normal, dragCorner);

    const intersection = new THREE.Vector3();
    if (!ray.intersectPlane(plane, intersection)) return;

    const diff = intersection.clone().sub(dragCorner);
    let newBounds = { ...base };
    const snapToGrid = (val: number) => Math.round(val);

    if (corner.xSide === "min") {
      newBounds.minX = snapToGrid(base.minX + diff.x);
    } else {
      newBounds.maxX = snapToGrid(base.maxX + diff.x);
    }
    if (corner.ySide === "min") {
      newBounds.minY = snapToGrid(base.minY + diff.y);
    } else {
      newBounds.maxY = snapToGrid(base.maxY + diff.y);
    }
    if (corner.zSide === "min") {
      newBounds.minZ = snapToGrid(base.minZ + diff.z);
    } else {
      newBounds.maxZ = snapToGrid(base.maxZ + diff.z);
    }

    if (newBounds.minX > newBounds.maxX) {
      [newBounds.minX, newBounds.maxX] = [newBounds.maxX, newBounds.minX];
    }
    if (newBounds.minY > newBounds.maxY) {
      [newBounds.minY, newBounds.maxY] = [newBounds.maxY, newBounds.minY];
    }
    if (newBounds.minZ > newBounds.maxZ) {
      [newBounds.minZ, newBounds.maxZ] = [newBounds.maxZ, newBounds.minZ];
    }

    if (shiftKey) {
      const anchor = {
        x: corner.xSide === "min" ? newBounds.maxX : newBounds.minX,
        y: corner.ySide === "min" ? newBounds.maxY : newBounds.minY,
        z: corner.zSide === "min" ? newBounds.maxZ : newBounds.minZ,
      };
      newBounds = snapBoundsToEqual(newBounds, anchor);
    }

    this.resizePendingBounds(context, newBounds);
  }

  onPendingMouseUp(_context: ToolContext, _mousePos: THREE.Vector2): void {
    this.resizingCorner = null;
    this.resizeBaseBounds = null;
  }

  resizePendingBounds(context: ToolContext, bounds: RectBounds): void {
    if (!this.pending) return;

    const dims = getActiveObject(context)!.dimensions;
    const clamp = (val: number, max: number) =>
      Math.max(0, Math.min(val, max - 1));

    this.pending.bounds = {
      minX: clamp(bounds.minX, dims.x),
      maxX: clamp(bounds.maxX, dims.x),
      minY: clamp(bounds.minY, dims.y),
      maxY: clamp(bounds.maxY, dims.y),
      minZ: clamp(bounds.minZ, dims.z),
      maxZ: clamp(bounds.maxZ, dims.z),
    };

    this.buildFrameFromBounds(context, this.pending.bounds);
    this.updateBoundsBox(context);
  }

  private applyAndClear(context: ToolContext, bounds: RectBounds): void {
    const mode = this.pending?.mode ?? context.mode;
    const selectedBlock = this.pending?.selectedBlock ?? context.selectedBlock;
    const objectId = this.pending?.objectId ?? (getActiveObject(context)?.id ?? "");
    const dims = getActiveObject(context)!.dimensions;
    const dimY = dims.y;
    const dimZ = dims.z;

    const frameDims = {
      x: bounds.maxX - bounds.minX + 1,
      y: bounds.maxY - bounds.minY + 1,
      z: bounds.maxZ - bounds.minZ + 1,
    };
    const frameMinPos = { x: bounds.minX, y: bounds.minY, z: bounds.minZ };
    const frame = new VoxelFrame(frameDims, frameMinPos);

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          const idx = x * dimY * dimZ + y * dimZ + z;
          const val = context.previewBuffer[idx];
          if (val !== 0) {
            frame.set(x, y, z, val);
            context.previewBuffer[idx] = 0;
          }
        }
      }
    }

    context.reducers.applyFrame(mode, selectedBlock, frame, objectId);
    context.projectManager.chunkManager.clearPreview();
    this.lastBounds = null;
  }

  commitPendingOperation(context: ToolContext): void {
    if (!this.pending) return;

    this.applyAndClear(context, this.pending.bounds);
    this.pending = null;
    this.clearBoundsBox(context);
  }

  cancelPendingOperation(context: ToolContext): void {
    if (!this.pending) return;
    this.clearLastBounds(context);
    context.projectManager.chunkManager.clearPreview();
    this.lastBounds = null;
    this.pending = null;
    this.resizingCorner = null;
    this.resizeBaseBounds = null;
    this.clearBoundsBox(context);
  }

  updatePending(context: ToolContext): void {
    if (!this.pending) return;
    this.pending.fillShape = this.fillShape;
    this.pending.direction = this.direction;
    this.pending.selectedBlock = context.selectedBlock;
    this.buildFrameFromBounds(context, this.pending.bounds);
    this.updateBoundsBox(context);
  }

  dispose(): void {
    if (this.boundsBoxHelper) {
      this.boundsBoxHelper.parent?.remove(this.boundsBoxHelper);
      this.boundsBoxHelper.geometry.dispose();
      (this.boundsBoxHelper.material as THREE.Material).dispose();
      this.boundsBoxHelper = null;
    }
    this.clearHandleMeshes();
  }

  private findResizeHandle(context: ToolContext, mousePos: THREE.Vector2): ResizeCorner | null {
    if (!this.pending) return null;

    const bounds = this.pending.bounds;
    const corners: { corner: ResizeCorner; world: THREE.Vector3 }[] = [];
    const sides: ("min" | "max")[] = ["min", "max"];

    for (const xSide of sides) {
      for (const ySide of sides) {
        for (const zSide of sides) {
          const wx = xSide === "min" ? bounds.minX : bounds.maxX + 1;
          const wy = ySide === "min" ? bounds.minY : bounds.maxY + 1;
          const wz = zSide === "min" ? bounds.minZ : bounds.maxZ + 1;
          corners.push({
            corner: { xSide, ySide, zSide },
            world: new THREE.Vector3(wx, wy, wz),
          });
        }
      }
    }

    let closest: ResizeCorner | null = null;
    let closestDist = Infinity;

    for (const { corner, world } of corners) {
      const screen = world.clone().project(context.camera);
      const dx = screen.x - mousePos.x;
      const dy = screen.y - mousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closest = corner;
      }
    }

    if (closestDist < RectTool.HANDLE_SCREEN_THRESHOLD) {
      return closest;
    }

    return null;
  }

  private updateBoundsBox(context: ToolContext): void {
    if (!this.pending) {
      this.clearBoundsBox(context);
      return;
    }

    this.renderBoundsBox(context, this.pending.bounds);
  }

  private renderBoundsBox(context: ToolContext, bounds: RectBounds): void {
    if (!this.boundsBoxHelper) {
      this.boundsBoxHelper = new THREE.Box3Helper(
        new THREE.Box3(),
        0xffaa00
      );
      context.scene.add(this.boundsBoxHelper);
    }

    this.boundsBoxHelper.box.min.set(bounds.minX, bounds.minY, bounds.minZ);
    this.boundsBoxHelper.box.max.set(bounds.maxX + 1, bounds.maxY + 1, bounds.maxZ + 1);
    this.boundsBoxHelper.updateMatrixWorld(true);

    this.updateHandleMeshes(context, bounds);
  }

  private updateHandleMeshes(context: ToolContext, bounds: RectBounds): void {
    if (this.handleMeshes.length === 0) {
      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(
          RectTool.HANDLE_SPHERE_GEOMETRY,
          RectTool.HANDLE_MATERIAL
        );
        this.handleMeshes.push(mesh);
        context.scene.add(mesh);
      }
    }

    const corners = [
      [bounds.minX, bounds.minY, bounds.minZ],
      [bounds.minX, bounds.minY, bounds.maxZ + 1],
      [bounds.minX, bounds.maxY + 1, bounds.minZ],
      [bounds.minX, bounds.maxY + 1, bounds.maxZ + 1],
      [bounds.maxX + 1, bounds.minY, bounds.minZ],
      [bounds.maxX + 1, bounds.minY, bounds.maxZ + 1],
      [bounds.maxX + 1, bounds.maxY + 1, bounds.minZ],
      [bounds.maxX + 1, bounds.maxY + 1, bounds.maxZ + 1],
    ];

    for (let i = 0; i < 8; i++) {
      this.handleMeshes[i].position.set(corners[i][0], corners[i][1], corners[i][2]);
    }
  }

  private clearHandleMeshes(): void {
    for (const mesh of this.handleMeshes) {
      mesh.parent?.remove(mesh);
    }
    this.handleMeshes = [];
  }

  private clearBoundsBox(_context: ToolContext): void {
    this.dispose();
  }
}
