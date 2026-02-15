import * as THREE from "three";
import { layers } from "./layers";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import type { ToolType } from "./tool-type";
import type { ProjectManager } from "./project-manager";
import { VoxelFrame } from "./voxel-frame";
import { RectTool } from "./tools/rect-tool";
import { BlockPickerTool } from "./tools/block-picker-tool";
import { MagicSelectTool } from "./tools/magic-select-tool";
import { MoveSelectionTool } from "./tools/move-selection-tool";
import { BrushTool } from "./tools/brush-tool";
import type { Tool, ToolOption, PendingBounds } from "./tool-interface";
import { raycastVoxels } from "./voxel-raycast";

type ResizeCorner = {
  xSide: "min" | "max";
  ySide: "min" | "max";
  zSide: "min" | "max";
};

export const Builder = class {
  private previewFrame: VoxelFrame;
  private stateStore: StateStore;
  private projectId: string;
  private dimensions: Vector3;
  private projectManager: ProjectManager;
  private selectedBlock: number = 1;
  private setSelectedBlockInParent: (index: number) => void;
  private selectedObject: number = 0;

  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;

  private currentTool: Tool;
  private currentMode: BlockModificationMode = { tag: "Attach" };
  private toolContext: {
    reducers: StateStore["reducers"];
    projectId: string;
    dimensions: Vector3;
    projectManager: ProjectManager;
    previewFrame: VoxelFrame;
    selectedBlock: number;
    selectedObject: number;
    setSelectedBlockInParent: (index: number) => void;
    mode: BlockModificationMode;
    camera: THREE.Camera;
  };
  private startPosition: THREE.Vector3 | null = null;
  private startMousePos: THREE.Vector2 | null = null;
  private isMouseDown: boolean = false;
  private lastPreviewStart: THREE.Vector3 | null = null;
  private lastPreviewEnd: THREE.Vector3 | null = null;
  private lastHoveredPosition: THREE.Vector3 | null = null;

  private resizingCorner: ResizeCorner | null = null;
  private resizeBaseBounds: PendingBounds | null = null;

  private boundMouseMove: (event: MouseEvent) => void;
  private boundMouseClick: (event: MouseEvent) => void;
  private boundMouseDown: (event: MouseEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  private lastCursorUpdateTime: number = 0;
  private readonly CURSOR_UPDATE_THROTTLE_MS = 16;
  private lastSentCursorPos: THREE.Vector3 | null = null;
  private lastSentCursorNormal: THREE.Vector3 | null = null;

  private static readonly HANDLE_SCREEN_THRESHOLD = 0.05;

  constructor(
    stateStore: StateStore,
    projectId: string,
    dimensions: Vector3,
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    projectManager: ProjectManager
  ) {
    this.stateStore = stateStore;
    this.projectId = projectId;
    this.dimensions = dimensions;
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;
    this.projectManager = projectManager;
    this.selectedBlock = 1;
    this.setSelectedBlockInParent = () => {};

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(layers.raycast);
    this.mouse = new THREE.Vector2();

    this.previewFrame = new VoxelFrame({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    this.currentTool = this.createTool("Rect");

    this.toolContext = {
      reducers: this.stateStore.reducers,
      projectId: this.projectId,
      dimensions: this.dimensions,
      projectManager: this.projectManager,
      previewFrame: this.previewFrame,
      selectedBlock: this.selectedBlock,
      selectedObject: this.selectedObject,
      setSelectedBlockInParent: this.setSelectedBlockInParent,
      mode: this.currentMode,
      camera: this.camera,
    };

    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseClick = this.onMouseClick.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);

    this.addEventListeners();
  }

  private commitPendingIfNeeded(): void {
    if (this.currentTool.hasPendingOperation?.()) {
      this.currentTool.commitPendingOperation?.(this.toolContext);
      this.projectManager.clearPendingBoundsBox();
    }
  }

  cancelCurrentOperation(): void {
    if (this.currentTool.hasPendingOperation?.()) {
      this.currentTool.cancelPendingOperation?.(this.toolContext);
      this.projectManager.clearPendingBoundsBox();
    }
    if (this.isMouseDown) {
      this.previewFrame.clear();
      this.projectManager.chunkManager.setPreview(this.previewFrame);
    }
    this.projectManager.clearMoveSelectionBox();
    this.isMouseDown = false;
    this.startPosition = null;
    this.startMousePos = null;
    this.lastPreviewStart = null;
    this.lastPreviewEnd = null;
    this.resizingCorner = null;
    this.resizeBaseBounds = null;
  }

  public setTool(tool: ToolType): void {
    this.commitPendingIfNeeded();
    this.cancelCurrentOperation();
    this.currentTool = this.createTool(tool);
    if (tool === "MoveSelection") {
      this.projectManager.updateMoveSelectionBox(this.selectedObject);
    }
  }

  private createTool(toolType: ToolType): Tool {
    switch (toolType) {
      case "MoveSelection":
        return new MoveSelectionTool();
      case "Rect":
        return new RectTool();
      case "Brush":
        return new BrushTool();
      case "BlockPicker":
        return new BlockPickerTool();
      case "MagicSelect":
        return new MagicSelectTool();
      default:
        throw new Error(
          `Unknown tool type: ${JSON.stringify(toolType)}`
        );
    }
  }

  public setMode(mode: BlockModificationMode): void {
    this.currentMode = mode;
    this.toolContext.mode = mode;
  }

  public getMode(): BlockModificationMode {
    return this.currentMode;
  }

  public getTool(): ToolType {
    return this.currentTool.getType();
  }

  public getToolOptions(): ToolOption[] {
    return this.currentTool.getOptions();
  }

  public setToolOption(name: string, value: string): void {
    this.currentTool.setOption(name, value);
  }

  public setSelectedBlock(
    block: number,
    setter: (index: number) => void
  ): void {
    this.selectedBlock = block;
    this.setSelectedBlockInParent = setter;
    this.toolContext.selectedBlock = block;
    this.toolContext.setSelectedBlockInParent = setter;
  }

  public setSelectedObject(objectIndex: number): void {
    this.selectedObject = objectIndex;
    this.toolContext.selectedObject = objectIndex;
    if (this.currentTool.getType() === "MoveSelection") {
      this.projectManager.updateMoveSelectionBox(this.selectedObject);
    }
  }

  public updateCamera(camera: THREE.Camera): void {
    this.camera = camera;
    this.toolContext.camera = camera;
  }

  private addEventListeners(): void {
    this.domElement.addEventListener("mousemove", this.boundMouseMove);
    this.domElement.addEventListener("mouseup", this.boundMouseClick);
    this.domElement.addEventListener("mousedown", this.boundMouseDown);
    this.domElement.addEventListener("contextmenu", this.boundContextMenu);
  }

  private removeEventListeners(): void {
    this.domElement.removeEventListener("mousemove", this.boundMouseMove);
    this.domElement.removeEventListener("mouseup", this.boundMouseClick);
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);
  }

  private onMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);

    if (this.resizingCorner) {
      this.handleResizeDrag();
      return;
    }

    const gridPos = this.checkIntersection();
    this.lastHoveredPosition = gridPos || this.lastHoveredPosition;
    if (gridPos) {
      this.handleMouseDrag(gridPos);
    }
  }

  private onMouseClick(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.updateMousePosition(event);

    if (this.resizingCorner) {
      this.handleResizeEnd();
      return;
    }

    const gridPos = this.checkIntersection();

    const position = gridPos || this.lastHoveredPosition;
    if (position) {
      this.handleMouseUp(position);
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this.updateMousePosition(event);

      if (this.currentTool.hasPendingOperation?.()) {
        const corner = this.findResizeHandle();
        if (corner) {
          this.resizingCorner = corner;
          this.resizeBaseBounds = this.currentTool.getPendingBounds?.() ?? null;
          this.isMouseDown = true;
          this.startMousePos = this.mouse.clone();
          return;
        }

        this.commitPendingIfNeeded();
      }

      this.isMouseDown = true;
      this.startMousePos = this.mouse.clone();

      const gridPos = this.checkIntersection();
      if (gridPos) {
        this.startPosition = gridPos.clone();
        this.currentTool.onMouseDown(this.toolContext, {
          gridPosition: gridPos,
          mousePosition: this.mouse.clone()
        });
      }
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private findResizeHandle(): ResizeCorner | null {
    const bounds = this.currentTool.getPendingBounds?.();
    if (!bounds) return null;

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
      const screen = world.clone().project(this.camera);
      const dx = screen.x - this.mouse.x;
      const dy = screen.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closest = corner;
      }
    }

    if (closestDist < Builder.HANDLE_SCREEN_THRESHOLD) {
      return closest;
    }

    return null;
  }

  private handleResizeDrag(): void {
    if (!this.resizingCorner || !this.resizeBaseBounds) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const ray = this.raycaster.ray;

    const corner = this.resizingCorner;
    const base = this.resizeBaseBounds;

    const dragX = corner.xSide === "min" ? base.minX : base.maxX;
    const dragY = corner.ySide === "min" ? base.minY : base.maxY;
    const dragZ = corner.zSide === "min" ? base.minZ : base.maxZ;
    const dragCorner = new THREE.Vector3(dragX + 0.5, dragY + 0.5, dragZ + 0.5);

    const viewDir = new THREE.Vector3();
    this.camera.getWorldDirection(viewDir);

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

    const newBounds = { ...base };

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
      const tmp = newBounds.minX;
      newBounds.minX = newBounds.maxX;
      newBounds.maxX = tmp;
    }
    if (newBounds.minY > newBounds.maxY) {
      const tmp = newBounds.minY;
      newBounds.minY = newBounds.maxY;
      newBounds.maxY = tmp;
    }
    if (newBounds.minZ > newBounds.maxZ) {
      const tmp = newBounds.minZ;
      newBounds.minZ = newBounds.maxZ;
      newBounds.maxZ = tmp;
    }

    this.currentTool.resizePendingBounds?.(this.toolContext, newBounds);
    this.updatePendingBoundsBox();
  }

  private handleResizeEnd(): void {
    this.resizingCorner = null;
    this.resizeBaseBounds = null;
    this.isMouseDown = false;
    this.startMousePos = null;
    this.updatePendingBoundsBox();
  }

  private updatePendingBoundsBox(): void {
    const bounds = this.currentTool.getPendingBounds?.();
    if (bounds) {
      this.projectManager.updatePendingBoundsBox(bounds);
    } else {
      this.projectManager.clearPendingBoundsBox();
    }
  }

  private throttledUpdateCursorPos(
    faceCenter: THREE.Vector3,
    worldNormal: THREE.Vector3
  ): void {
    const now = Date.now();

    const hasPositionChanged = !this.vectorsApproximatelyEqual(
      this.lastSentCursorPos,
      faceCenter,
      0.01
    );

    const hasNormalChanged = !this.vectorsApproximatelyEqual(
      this.lastSentCursorNormal,
      worldNormal,
      0.01
    );

    if (hasPositionChanged || hasNormalChanged) {
      this.projectManager.onLocalCursorUpdate?.(faceCenter, worldNormal);
    }

    if (now - this.lastCursorUpdateTime >= this.CURSOR_UPDATE_THROTTLE_MS) {
      if (hasPositionChanged || hasNormalChanged) {
        this.stateStore.reducers.updateCursorPos(
          this.projectId,
          "local",
          faceCenter,
          worldNormal
        );

        this.lastSentCursorPos = faceCenter.clone();
        this.lastSentCursorNormal = worldNormal.clone();
      }

      this.lastCursorUpdateTime = now;
    }
  }

  private checkIntersection(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const voxelResult = raycastVoxels(
      this.raycaster.ray.origin,
      this.raycaster.ray.direction,
      this.dimensions,
      this.projectManager.chunkManager.getVoxelAtWorldPos.bind(this.projectManager.chunkManager)
    );

    if (voxelResult) {
      const faceCenter = voxelResult.gridPosition.clone().addScalar(0.5);
      
      if (voxelResult.normal.x !== 0) {
        faceCenter.x = voxelResult.gridPosition.x + (voxelResult.normal.x > 0 ? 1 : 0);
      }
      if (voxelResult.normal.y !== 0) {
        faceCenter.y = voxelResult.gridPosition.y + (voxelResult.normal.y > 0 ? 1 : 0);
      }
      if (voxelResult.normal.z !== 0) {
        faceCenter.z = voxelResult.gridPosition.z + (voxelResult.normal.z > 0 ? 1 : 0);
      }

      this.throttledUpdateCursorPos(faceCenter, voxelResult.normal);

      const gridPos = this.currentTool.calculateGridPosition(
        voxelResult.gridPosition.clone(),
        voxelResult.normal.clone(),
        this.currentMode
      );

      if (gridPos.x < 0 || gridPos.x >= this.dimensions.x ||
          gridPos.y < 0 || gridPos.y >= this.dimensions.y ||
          gridPos.z < 0 || gridPos.z >= this.dimensions.z) {
        return null;
      }

      return gridPos;
    }

    return null;
  }

  private handleMouseDrag(gridPos: THREE.Vector3): void {
    if (this.isMouseDown && !this.startPosition) {
      this.startPosition = gridPos.clone();
      this.startMousePos = this.mouse.clone();
    }

    if (
      this.lastPreviewStart &&
      this.lastPreviewEnd &&
      this.startPosition &&
      this.lastPreviewStart.equals(this.startPosition) &&
      this.lastPreviewEnd.equals(gridPos)
    ) {
      return;
    }

    if (this.isMouseDown && this.startPosition && this.startMousePos) {
      this.currentTool.onDrag(this.toolContext, {
        startGridPosition: this.startPosition,
        currentGridPosition: gridPos,
        startMousePosition: this.startMousePos,
        currentMousePosition: this.mouse.clone()
      });
      this.lastPreviewStart = this.startPosition.clone();
      this.lastPreviewEnd = gridPos.clone();
    }
  }

  private handleMouseUp(position: THREE.Vector3): void {
    const endPos = position;
    const startPos = this.startPosition || position;
    const startMousePos = this.startMousePos || this.mouse.clone();
    const endMousePos = this.mouse.clone();

    this.currentTool.onMouseUp(this.toolContext, {
      startGridPosition: startPos,
      currentGridPosition: endPos,
      startMousePosition: startMousePos,
      currentMousePosition: endMousePos
    });

    this.isMouseDown = false;
    this.startPosition = null;
    this.startMousePos = null;
    this.lastPreviewStart = null;
    this.lastPreviewEnd = null;

    this.updatePendingBoundsBox();
  }

  private vectorsApproximatelyEqual(
    a: THREE.Vector3 | null,
    b: THREE.Vector3,
    epsilon: number = 0.001
  ): boolean {
    if (!a) return false;

    return (
      Math.abs(a.x - b.x) < epsilon &&
      Math.abs(a.y - b.y) < epsilon &&
      Math.abs(a.z - b.z) < epsilon
    );
  }

  public dispose(): void {
    this.commitPendingIfNeeded();
    this.projectManager.clearMoveSelectionBox();
    this.projectManager.clearPendingBoundsBox();
    this.removeEventListeners();
  }
};
