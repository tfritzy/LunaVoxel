import * as THREE from "three";
import { DbConnection } from "../../module_bindings";

export class Builder {
  private domElement: HTMLElement;
  private dbConn: DbConnection;
  private world: string;

  private boundMouseDown: (event: MouseEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  constructor(
    scene: THREE.Scene,
    dbConn: DbConnection,
    domElement: HTMLElement,
    world: string
  ) {
    this.domElement = domElement;
    this.dbConn = dbConn;
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
    // if (this.previewBlock && !this.isLoading) {
    //   this.previewBlock.position.set(position.x, position.y, position.z);
    // }
  }

  rotateBlock() {
    // if (this.previewBlock && !this.isLoading) {
    //   this.currentRotation =
    //     (this.currentRotation + Math.PI / 2) % (Math.PI * 2);
    //   this.previewBlock.rotation.y = this.currentRotation;
    // }
  }

  async onMouseClick(position: THREE.Vector3) {
    console.log(
      this.world,
      { tag: "Block" },
      position.x,
      position.y,
      position.z
    );
    this.dbConn.reducers.placeBlock(
      this.world,
      { tag: "Block" },
      position.x,
      position.y,
      position.z
    );
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);
  }
}
