import * as THREE from "three";
import { DbConnection } from "../../module_bindings";
import { Tool } from "./grid-raycaster";

export class Builder {
  private domElement: HTMLElement;
  private dbConn: DbConnection;
  private world: string;
  private currentTool: Tool = "build";
  private startPosition: THREE.Vector3 | null = null;
  private isMouseDown: boolean = false;
  private lastPreviewStart: THREE.Vector3 | null = null;
  private lastPreviewEnd: THREE.Vector3 | null = null;

  private boundMouseDown: (event: MouseEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  constructor(dbConn: DbConnection, domElement: HTMLElement, world: string) {
    this.dbConn = dbConn;
    this.domElement = domElement;
    this.world = world;

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);

    this.domElement.addEventListener("mousedown", this.boundMouseDown);
    this.domElement.addEventListener("contextmenu", this.boundContextMenu);
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      this.isMouseDown = true;
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  public setTool(tool: Tool): void {
    this.currentTool = tool;
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

      if (this.currentTool === "build") {
        this.dbConn.reducers.buildBlock(
          this.world,
          { tag: "Block" },
          currentStart.x,
          currentStart.z,
          currentStart.y,
          currentEnd.x,
          currentEnd.z,
          currentEnd.y,
          true
        );
      } else if (this.currentTool === "erase") {
        this.dbConn.reducers.eraseBlock(
          this.world,
          currentStart.x,
          currentStart.z,
          currentStart.y,
          currentEnd.x,
          currentEnd.z,
          currentEnd.y,
          true
        );
      } else if (this.currentTool === "paint") {
        this.dbConn.reducers.paintBlock(
          this.world,
          currentStart.x,
          currentStart.z,
          currentStart.y,
          currentEnd.x,
          currentEnd.z,
          currentEnd.y,
          true
        );
      }

      this.lastPreviewStart = currentStart.clone();
      this.lastPreviewEnd = currentEnd.clone();
    }
  }

  public onMouseClick(position: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    const endPos = position;
    const startPos = this.startPosition || position;

    if (this.currentTool === "paint") {
      this.dbConn.reducers.paintBlock(
        this.world,
        startPos.x,
        startPos.z,
        startPos.y,
        endPos.x,
        endPos.z,
        endPos.y,
        false
      );
    } else if (this.currentTool === "build") {
      this.dbConn.reducers.buildBlock(
        this.world,
        { tag: "Block" },
        startPos.x,
        startPos.z,
        startPos.y,
        endPos.x,
        endPos.z,
        endPos.y,
        false
      );
    } else if (this.currentTool === "erase") {
      this.dbConn.reducers.eraseBlock(
        this.world,
        startPos.x,
        startPos.z,
        startPos.y,
        endPos.x,
        endPos.z,
        endPos.y,
        false
      );
    }

    this.isMouseDown = false;
    this.startPosition = null;
    this.lastPreviewStart = null;
    this.lastPreviewEnd = null;
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);
  }
}
