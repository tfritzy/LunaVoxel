import { Block, blocks } from "../blocks";
import * as THREE from "three";
import { layers } from "./layers";

export class Builder {
  private previewBlock: THREE.Object3D;
  private scene: THREE.Scene;
  private selectedBlock: Block;
  private ghostMat: THREE.Material;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.selectedBlock = blocks[1];
    this.previewBlock = this.createPreviewBlock();
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: "#c5cae9",
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
    });
  }

  onMouseHover(position: THREE.Vector3) {
    console.log("move preview to", position);
    this.previewBlock.position.set(position.x, position.y, position.z);
  }

  onMouseClick(position: THREE.Vector3) {
    const block = new THREE.Mesh(
      this.selectedBlock.geometry,
      this.selectedBlock.material
    );
    block.layers.set(layers.blocks);
    block.position.set(position.x, position.y, position.z);
    this.scene.add(block);
  }

  createPreviewBlock() {
    const block = new THREE.Mesh(this.selectedBlock.geometry, this.ghostMat);
    block.layers.set(layers.ghost);
    block.position.set(0, 0.5, 0);
    this.scene.add(block);
    return block;
  }
}
