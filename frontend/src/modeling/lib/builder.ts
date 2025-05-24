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

  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseUp: (event: MouseEvent) => void;
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

  onMouseHover(position: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    if (this.isMouseDown) {
      if (!this.startPosition) {
        this.startPosition = position.clone();
      }
    }
  }

  onMouseClick(position: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    const blockType =
      this.currentTool === "erase"
        ? ({ tag: "Empty" } as const)
        : ({ tag: "Block" } as const);

    const endPos = position;
    const startPos = this.startPosition || position;

    this.dbConn.reducers.placeBlock(
      this.world,
      blockType,
      startPos.x,
      startPos.z,
      startPos.y,
      endPos.x,
      endPos.z,
      endPos.y
    );

    this.isMouseDown = false;
    this.startPosition = null;
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.domElement.removeEventListener("mouseup", this.boundMouseUp);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);
  }
}
