import * as THREE from "three";
import { layers } from "./layers";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import type { ToolType } from "./tool-type";
import type { ProjectManager } from "./project-manager";
import { RectTool } from "./tools/rect-tool";
import { BlockPickerTool } from "./tools/block-picker-tool";
import { MagicSelectTool } from "./tools/magic-select-tool";
import { MoveSelectionTool } from "./tools/move-selection-tool";
import type { Tool } from "./tool-interface";

export const Builder = class {
  private stateStore: StateStore;
  private projectId: string;
  private dimensions: Vector3;
  private projectManager: ProjectManager;
  private selectedBlock: number = 1;
  private setSelectedBlockInParent: (index: number) => void;
  private selectedLayer: number = 0;

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
    selectedBlock: number;
    selectedLayer: number;
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

  private boundMouseMove: (event: MouseEvent) => void;
  private boundMouseClick: (event: MouseEvent) => void;
  private boundMouseDown: (event: MouseEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  private lastCursorUpdateTime: number = 0;
  private readonly CURSOR_UPDATE_THROTTLE_MS = 16;
  private lastSentCursorPos: THREE.Vector3 | null = null;
  private lastSentCursorNormal: THREE.Vector3 | null = null;

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

    this.currentTool = this.createTool("Rect");

    this.toolContext = {
      reducers: this.stateStore.reducers,
      projectId: this.projectId,
      dimensions: this.dimensions,
      projectManager: this.projectManager,
      selectedBlock: this.selectedBlock,
      selectedLayer: this.selectedLayer,
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

  cancelCurrentOperation(): void {
    if (this.isMouseDown) {
      this.projectManager.octreeManager.clearPreview();
    }
    this.isMouseDown = false;
    this.startPosition = null;
    this.startMousePos = null;
    this.lastPreviewStart = null;
    this.lastPreviewEnd = null;
  }

  public setTool(tool: ToolType): void {
    this.cancelCurrentOperation();
    this.currentTool = this.createTool(tool);
  }

  private createTool(toolType: ToolType): Tool {
    switch (toolType) {
      case "MoveSelection":
        return new MoveSelectionTool();
      case "Rect":
        return new RectTool();
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

  public setSelectedBlock(
    block: number,
    setter: (index: number) => void
  ): void {
    this.selectedBlock = block;
    this.setSelectedBlockInParent = setter;
    this.toolContext.selectedBlock = block;
    this.toolContext.setSelectedBlockInParent = setter;
  }

  public setSelectedLayer(layer: number): void {
    this.selectedLayer = layer;
    this.toolContext.selectedLayer = layer;
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
    const gridPos = this.checkIntersection();

    const position = gridPos || this.lastHoveredPosition;
    if (position) {
      this.handleMouseUp(position);
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this.isMouseDown = true;
      this.startMousePos = this.mouse.clone();

      const gridPos = this.checkIntersection();
      if (gridPos) {
        this.startPosition = gridPos.clone();
        this.currentTool.onMouseDown(this.toolContext, {
          gridPosition: gridPos,
          mousePosition: this.mouse.clone()
        });
        this.handleMouseDrag(gridPos);
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
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const intersectionPoint = intersection.point;
      const face = intersection.face;

      if (face) {
        const worldNormal = face.normal.clone();
        worldNormal.transformDirection(intersection.object.matrixWorld);
        worldNormal.normalize();
        
        const faceCenter = intersectionPoint.clone();

        if (Math.abs(worldNormal.x) < 0.1) {
          faceCenter.x = Math.floor(faceCenter.x) + 0.5;
        }

        if (Math.abs(worldNormal.y) < 0.1) {
          faceCenter.y = Math.floor(faceCenter.y) + 0.5;
        }

        if (Math.abs(worldNormal.z) < 0.1) {
          faceCenter.z = Math.floor(faceCenter.z) + 0.5;
        }

        this.throttledUpdateCursorPos(faceCenter, worldNormal);

        return this.currentTool.calculateGridPosition(
          intersectionPoint.clone(),
          face.normal.clone(),
          this.currentMode
        );
      }
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
    this.removeEventListeners();
  }
};
