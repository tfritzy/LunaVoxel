import * as THREE from "three";
import { layers } from "./layers";
import {
  BlockModificationMode,
  DbConnection,
  Vector3,
} from "../../module_bindings";
import { Block } from "./blocks";

export const Builder = class {
  public previewBlocks: (Block | undefined)[][][];
  private dbConn: DbConnection;
  private projectId: string;
  private dimensions: Vector3;
  private onPreviewUpdate: () => void;
  private selectedBlock: number;

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

  constructor(
    dbConn: DbConnection,
    projectId: string,
    dimensions: Vector3,
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    onPreviewUpdate: () => void
  ) {
    this.dbConn = dbConn;
    this.projectId = projectId;
    this.dimensions = dimensions;
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;
    this.onPreviewUpdate = onPreviewUpdate;
    this.selectedBlock = 1;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(layers.raycast);
    this.mouse = new THREE.Vector2();

    this.previewBlocks = this.initializePreviewBlocks();

    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseClick = this.onMouseClick.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);

    this.addEventListeners();
  }

  public setTool(tool: BlockModificationMode): void {
    this.currentTool = tool;
  }

  public setSelectedBlock(block: number): void {
    this.selectedBlock = block;
  }

  public updateCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  public getTool(): BlockModificationMode {
    return this.currentTool;
  }

  private initializePreviewBlocks(): (Block | undefined)[][][] {
    const previewBlocks: (Block | undefined)[][][] = [];
    for (let x = 0; x <= this.dimensions.x; x++) {
      previewBlocks[x] = [];
      for (let y = 0; y <= this.dimensions.y; y++) {
        previewBlocks[x][y] = [];
        for (let z = 0; z <= this.dimensions.z; z++) {
          previewBlocks[x][y][z] = undefined;
        }
      }
    }
    return previewBlocks;
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
      this.onMouseHover(gridPos);
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
    if (now - this.lastCursorUpdateTime >= this.CURSOR_UPDATE_THROTTLE_MS) {
      this.dbConn.reducers.updateCursorPos(
        this.projectId,
        this.dbConn.identity!,
        faceCenter.x,
        faceCenter.y,
        faceCenter.z,
        worldNormal.x,
        worldNormal.y,
        worldNormal.z
      );
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

        const faceCenter = new THREE.Vector3(
          gridPos.x + 0.5,
          gridPos.y + 0.5,
          gridPos.z + 0.5
        );

        const absNormal = new THREE.Vector3(
          Math.abs(worldNormal.x),
          Math.abs(worldNormal.y),
          Math.abs(worldNormal.z)
        );
        if (absNormal.x > absNormal.y && absNormal.x > absNormal.z) {
          faceCenter.x = gridPos.x + (worldNormal.x > 0 ? 1 : 0);
        } else if (absNormal.y > absNormal.x && absNormal.y > absNormal.z) {
          faceCenter.y = gridPos.y + (worldNormal.y > 0 ? 1 : 0);
        } else {
          faceCenter.z = gridPos.z + (worldNormal.z > 0 ? 1 : 0);
        }
        this.throttledUpdateCursorPos(faceCenter, worldNormal);
      }

      if (intersection.object.userData.isBoundaryBox) {
        return gridPos;
      } else {
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
    }

    return null;
  }

  private floorVector3(vector3: THREE.Vector3): THREE.Vector3 {
    vector3.x = Math.floor(vector3.x);
    vector3.y = Math.floor(vector3.y);
    vector3.z = Math.floor(vector3.z);
    return vector3;
  }

  private onMouseHover(gridPos: THREE.Vector3): void {
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

    this.clearPreviewBlocks();
    this.modifyBlock(this.currentTool, startPos, endPos);

    this.isMouseDown = false;
    this.startPosition = null;
    this.lastPreviewStart = null;
    this.lastPreviewEnd = null;
  }

  private clearPreviewBlocks(): void {
    for (let x = 0; x <= this.dimensions.x; x++) {
      for (let y = 0; y <= this.dimensions.y; y++) {
        for (let z = 0; z <= this.dimensions.z; z++) {
          this.previewBlocks[x][y][z] = undefined;
        }
      }
    }
  }

  private previewBlock(startPos: THREE.Vector3, endPos: THREE.Vector3): void {
    this.clearPreviewBlocks();

    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);
    const minZ = Math.min(startPos.z, endPos.z);
    const maxZ = Math.max(startPos.z, endPos.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (
            x >= 0 &&
            x <= this.dimensions.x &&
            y >= 0 &&
            y <= this.dimensions.y &&
            z >= 0 &&
            z <= this.dimensions.z
          ) {
            this.previewBlocks[x][y][z] = {
              rotation: 0,
              type: this.selectedBlock,
            };
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

    this.dbConn.reducers.modifyBlockRect(
      this.projectId,
      tool,
      this.selectedBlock,
      startPos.x,
      startPos.y,
      startPos.z,
      endPos.x,
      endPos.y,
      endPos.z,
      0
    );
  }

  public dispose(): void {
    this.removeEventListeners();
  }
};
