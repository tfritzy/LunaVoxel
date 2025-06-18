import * as THREE from "three";
import {
  BlockModificationMode,
  DbConnection,
  MeshType,
  Vector3,
} from "../../module_bindings";

export class Builder {
  public previewBlocks: (MeshType | undefined)[][][];
  private dbConn: DbConnection;
  private world: string;
  private currentTool: BlockModificationMode = { tag: "Build" };
  private startPosition: THREE.Vector3 | null = null;
  private isMouseDown: boolean = false;
  private worldDimensions: Vector3;
  private lastPreviewStart: THREE.Vector3 | null = null;
  private lastPreviewEnd: THREE.Vector3 | null = null;
  private onPreviewUpdate: () => void;
  private selectedColor: number;

  private boundMouseDown: (event: MouseEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  constructor(
    dbConn: DbConnection,
    world: string,
    worldDimensions: Vector3,
    container: HTMLElement,
    onPreviewUpdate: () => void
  ) {
    this.dbConn = dbConn;
    this.world = world;
    this.onPreviewUpdate = onPreviewUpdate;
    this.selectedColor = 0xffffff;

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);
    this.worldDimensions = worldDimensions;

    this.previewBlocks = this.initializePreviewBlocks();

    container.addEventListener("mousedown", this.boundMouseDown);
    container.addEventListener("contextmenu", this.boundContextMenu);
  }

  public setSelectedColor(color: number) {
    this.selectedColor = color;
  }

  private initializePreviewBlocks(): (MeshType | undefined)[][][] {
    const previewBlocks: (MeshType | undefined)[][][] = [];
    for (let x = 0; x <= this.worldDimensions.x; x++) {
      previewBlocks[x] = [];
      for (let y = 0; y <= this.worldDimensions.y; y++) {
        previewBlocks[x][y] = [];
        for (let z = 0; z <= this.worldDimensions.z; z++) {
          previewBlocks[x][y][z] = undefined;
        }
      }
    }

    return previewBlocks;
  }

  private clearPreviewBlocks(): void {
    for (let x = 0; x < this.previewBlocks.length; x++) {
      for (let y = 0; y < this.previewBlocks[x].length; y++) {
        for (let z = 0; z < this.previewBlocks[x][y].length; z++) {
          if (this.previewBlocks[x][y][z]) {
            this.previewBlocks[x][y][z] = undefined;
          }
        }
      }
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

  public setTool(tool: BlockModificationMode): void {
    this.currentTool = tool;
  }

  public getTool(): BlockModificationMode {
    return this.currentTool;
  }

  private previewBlock(startPos: THREE.Vector3, endPos: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    const minPos = new THREE.Vector3(
      Math.min(startPos.x, endPos.x),
      Math.min(startPos.y, endPos.y),
      Math.min(startPos.z, endPos.z)
    );

    const maxPos = new THREE.Vector3(
      Math.max(startPos.x, endPos.x),
      Math.max(startPos.y, endPos.y),
      Math.max(startPos.z, endPos.z)
    );

    minPos.clamp(new THREE.Vector3(0, 0, 0), this.worldDimensions);
    maxPos.clamp(new THREE.Vector3(0, 0, 0), this.worldDimensions);

    this.clearPreviewBlocks();
    for (let x = minPos.x; x <= maxPos.x; x++) {
      for (let y = minPos.y; y <= maxPos.y; y++) {
        for (let z = minPos.z; z <= maxPos.z; z++) {
          this.previewBlocks[x][y][z] = { tag: "Block" };
        }
      }
    }

    this.onPreviewUpdate();
  }

  private modifyBlock(
    tool: BlockModificationMode,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    color: number
  ) {
    if (!this.dbConn.isActive) return;

    this.dbConn.reducers.modifyBlockRect(
      this.world,
      tool,
      { tag: "Block" },
      startPos.x,
      startPos.y,
      startPos.z,
      endPos.x,
      endPos.y,
      endPos.z,
      color
    );
  }

  public onMouseHover(position: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    if (this.isMouseDown) {
      if (!this.startPosition) {
        this.startPosition = position.clone();
      }

      const currentStart = this.startPosition;
      const currentEnd = position;
      if (
        this.lastPreviewStart &&
        this.lastPreviewEnd &&
        this.lastPreviewStart.equals(currentStart) &&
        this.lastPreviewEnd.equals(currentEnd)
      ) {
        return;
      }

      this.previewBlock(currentStart, currentEnd);

      this.lastPreviewStart = currentStart.clone();
      this.lastPreviewEnd = currentEnd.clone();
    }
  }

  public onMouseClick(position: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    const endPos = position;
    const startPos = this.startPosition || position;

    this.clearPreviewBlocks();
    this.modifyBlock(this.currentTool, startPos, endPos, this.selectedColor);

    this.isMouseDown = false;
    this.startPosition = null;
    this.lastPreviewStart = null;
    this.lastPreviewEnd = null;
  }
}
