import * as THREE from "three";
import { layers } from "./layers";
import {
  BlockModificationMode,
  DbConnection,
  Vector3,
} from "../../module_bindings";
import { encodeBlockData, setPreviewBit } from "./voxel-data-utils";

export const Builder = class {
  public previewBlocks: Uint32Array;
  private dbConn: DbConnection;
  private projectId: string;
  private dimensions: Vector3;
  private onPreviewUpdate: () => void;
  private onCommitRect?: (
    tool: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    layerIndex: number
  ) => void;
  private onLocalCursorUpdate?: (
    position: THREE.Vector3,
    normal: THREE.Vector3
  ) => void;
  private selectedBlock: number = 1;
  private selectedLayer: number = 0;

  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;

  private currentTool: BlockModificationMode = { tag: "Build" };
  private startPosition: THREE.Vector3 | null = null;
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
    dbConn: DbConnection,
    projectId: string,
    dimensions: Vector3,
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    onPreviewUpdate: () => void,
    onCommitRect?: (
      tool: BlockModificationMode,
      start: THREE.Vector3,
      end: THREE.Vector3,
      blockType: number,
      layerIndex: number
    ) => void,
    onLocalCursorUpdate?: (
      position: THREE.Vector3,
      normal: THREE.Vector3
    ) => void
  ) {
    this.dbConn = dbConn;
    this.projectId = projectId;
    this.dimensions = dimensions;
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;
    this.onPreviewUpdate = onPreviewUpdate;
    this.onCommitRect = onCommitRect;
    this.onLocalCursorUpdate = onLocalCursorUpdate;
    this.selectedBlock = 1;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(layers.raycast);
    this.mouse = new THREE.Vector2();

    this.previewBlocks = new Uint32Array(
      dimensions.x * dimensions.y * dimensions.z
    );

    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseClick = this.onMouseClick.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);

    this.addEventListeners();
  }

  private getBlockIndex(x: number, y: number, z: number): number {
    return (
      x * this.dimensions.y * this.dimensions.z + y * this.dimensions.z + z
    );
  }

  private setPreviewBlock(
    x: number,
    y: number,
    z: number,
    blockType: number,
    rotation: number = 0
  ): void {
    const blockIndex = this.getBlockIndex(x, y, z);
    const blockValue = setPreviewBit(encodeBlockData(blockType, rotation));
    this.previewBlocks[blockIndex] = blockValue;
  }

  public setTool(tool: BlockModificationMode): void {
    this.currentTool = tool;
  }

  public setSelectedBlock(block: number): void {
    this.selectedBlock = block;
  }

  public setSelectedLayer(layer: number): void {
    this.selectedLayer = layer;
  }

  public updateCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  public getTool(): BlockModificationMode {
    return this.currentTool;
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
      this.preview(gridPos);
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
      this.onMouseClickHandler(position);
    }
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this.isMouseDown = true;

      const gridPos = this.checkIntersection();
      if (gridPos) {
        this.preview(gridPos);
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

    if ((hasPositionChanged || hasNormalChanged) && this.onLocalCursorUpdate) {
      this.onLocalCursorUpdate(faceCenter, worldNormal);
    }

    if (now - this.lastCursorUpdateTime >= this.CURSOR_UPDATE_THROTTLE_MS) {
      if (hasPositionChanged || hasNormalChanged) {
        this.dbConn.reducers.updateCursorPos(
          this.projectId,
          this.dbConn.identity!,
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
      const gridPos = this.floorVector3(intersectionPoint.clone());

      if (face) {
        const worldNormal = face.normal.clone();
        worldNormal.transformDirection(intersection.object.matrixWorld);
        worldNormal.normalize();
        const faceCenter = intersectionPoint;

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
      }

      if (
        this.currentTool.tag === "Erase" ||
        this.currentTool.tag === "Paint"
      ) {
        const normal = intersection.face?.normal.multiplyScalar(-0.1);
        if (normal) {
          return this.floorVector3(intersectionPoint.add(normal));
        }
        return gridPos;
      } else {
        const normal = intersection.face?.normal.multiplyScalar(0.1);
        if (normal) {
          return this.floorVector3(intersectionPoint.add(normal));
        }
        return gridPos;
      }
    }

    return null;
  }

  private floorVector3(vector3: THREE.Vector3): THREE.Vector3 {
    vector3.x = Math.floor(vector3.x);
    vector3.y = Math.floor(vector3.y);
    vector3.z = Math.floor(vector3.z);
    return vector3;
  }

  private preview(gridPos: THREE.Vector3): void {
    if (!this.dbConn.isActive) return;

    if (this.isMouseDown && !this.startPosition) {
      this.startPosition = gridPos.clone();
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

    if (this.isMouseDown && this.startPosition) {
      this.previewBlock(this.startPosition, gridPos);
      this.lastPreviewStart = this.startPosition.clone();
      this.lastPreviewEnd = gridPos.clone();
    }
  }

  private onMouseClickHandler(position: THREE.Vector3): void {
    if (!this.dbConn.isActive) return;

    const endPos = position;
    const startPos = this.startPosition || position;

    this.modifyBlock(this.currentTool, startPos, endPos);

    this.isMouseDown = false;
    this.startPosition = null;
    this.lastPreviewStart = null;
    this.lastPreviewEnd = null;
  }

  private clearPreviewBlocks(): void {
    this.previewBlocks.fill(0);
  }

  private previewBlock(startPos: THREE.Vector3, endPos: THREE.Vector3): void {
    this.clearPreviewBlocks();

    const minX = Math.max(
      0,
      Math.min(startPos.x, endPos.x, this.dimensions.x - 1)
    );
    const maxX = Math.min(
      this.dimensions.x - 1,
      Math.max(startPos.x, endPos.x, 0)
    );
    const minY = Math.max(
      0,
      Math.min(startPos.y, endPos.y, this.dimensions.y - 1)
    );
    const maxY = Math.min(
      this.dimensions.y - 1,
      Math.max(startPos.y, endPos.y, 0)
    );
    const minZ = Math.max(
      0,
      Math.min(startPos.z, endPos.z, this.dimensions.z - 1)
    );
    const maxZ = Math.min(
      this.dimensions.z - 1,
      Math.max(startPos.z, endPos.z, 0)
    );

    console.log(minX, minY, minZ, maxX, maxY, maxZ);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (
            x >= 0 &&
            x < this.dimensions.x &&
            y >= 0 &&
            y < this.dimensions.y &&
            z >= 0 &&
            z < this.dimensions.z
          ) {
            this.setPreviewBlock(x, y, z, this.selectedBlock);
          }
        }
      }
    }

    this.onPreviewUpdate();
  }

  private modifyBlock(
    tool: BlockModificationMode,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    if (!this.dbConn.isActive) return;

    this.clearPreviewBlocks();
    this.onCommitRect?.(
      tool,
      startPos.clone(),
      endPos.clone(),
      this.selectedBlock,
      this.selectedLayer
    );

    this.dbConn.reducers.modifyBlockRect(
      this.projectId,
      tool,
      this.selectedBlock,
      startPos,
      endPos,
      0,
      this.selectedLayer
    );
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
