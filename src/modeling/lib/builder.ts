import { Block, blocks } from "../../blocks";
import { GridPosition } from "../../types";
import * as THREE from "three";

export class Builder {
  private previewBlock: THREE.Object3D;
  private scene: THREE.Scene;
  private selectedBlock: Block;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.selectedBlock = blocks[0];
    this.previewBlock = this.createPreviewBlock();
  }

  onMouseHover(position: GridPosition) {
    this.previewBlock.position.set(position.x, 0.5, position.z);
  }

  onMouseClick(position: GridPosition) {
    const block = new THREE.Mesh(
      this.selectedBlock.geometry,
      this.selectedBlock.material
    );
    block.position.set(position.x, 0.5, position.z);
    this.scene.add(block);
  }

  createPreviewBlock() {
    const block = new THREE.Mesh(
      this.selectedBlock.geometry,
      this.selectedBlock.material
    );
    block.position.set(0, 0.5, 0);
    this.scene.add(block);
    return block;
  }
}
