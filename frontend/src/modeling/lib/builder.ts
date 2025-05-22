import * as THREE from "three";
import { DbConnection } from "../../module_bindings";

export class Builder {
  private domElement: HTMLElement;
  private dbConn: DbConnection;
  private world: string;

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
    if (event.button === 2) {
      this.rotateBlock();
    }
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  onMouseHover(position: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    this.dbConn.reducers.placeBlock(
      this.world,
      { tag: "Block" },
      position.x,
      position.z,
      position.y,
      true
    );
  }

  rotateBlock() {}

  onMouseClick(position: THREE.Vector3) {
    if (!this.dbConn.isActive) return;

    this.dbConn.reducers.placeBlock(
      this.world,
      { tag: "Block" },
      position.x,
      position.z,
      position.y,
      false
    );
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);
  }
}
