import { GridPosition } from "../../types";
import * as THREE from "three";

export class Builder {
  private previewBlock: THREE.Object3D;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.previewBlock = this.createPreviewBlock();
  }

  onMouseHover(position: GridPosition) {
    this.previewBlock.position.set(position.x, 0, position.z);
  }

  createPreviewBlock() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({
      color: "#93c5fd",
      transparent: true,
      opacity: 0.5,
    });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(0, 0.5, 0);
    this.scene.add(block);
    return block;
  }
}
