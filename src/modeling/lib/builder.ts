import { blocks, loadModel } from "../blocks";
import * as THREE from "three";
import { layers } from "./layers";

export class Builder {
  private previewBlock: THREE.Object3D | null = null;
  private scene: THREE.Scene;
  private selectedBlockIndex: number = 1;
  private ghostMaterial: THREE.Material;
  private loadedModels: Map<string, THREE.Group> = new Map();
  private isLoading: boolean = false;
  private currentRotation: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: "#0096FF",
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
    });

    this.preloadModels();
  }

  private async preloadModels() {
    for (const block of blocks) {
      try {
        if (!this.loadedModels.has(block.modelPath)) {
          const model = await loadModel(block.modelPath);
          this.loadedModels.set(block.modelPath, model);
        }
      } catch (error) {
        console.error(`Failed to load model: ${block.modelPath}`, error);
      }
    }

    await this.createPreviewBlock();
  }

  private async createPreviewBlock() {
    this.isLoading = true;

    if (this.previewBlock) {
      this.scene.remove(this.previewBlock);
      this.previewBlock = null;
    }

    const selectedBlock = blocks[this.selectedBlockIndex];

    try {
      let model: THREE.Group;

      if (this.loadedModels.has(selectedBlock.modelPath)) {
        model = this.loadedModels.get(selectedBlock.modelPath)!.clone();
      } else {
        const loadedModel = await loadModel(selectedBlock.modelPath);
        this.loadedModels.set(selectedBlock.modelPath, loadedModel);
        model = loadedModel.clone();
      }

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = this.ghostMaterial;
          child.layers.set(layers.ghost);
        }
      });

      model.position.set(0, 0.5, 0);

      model.rotation.y = this.currentRotation;

      this.scene.add(model);
      this.previewBlock = model;
    } catch (error) {
      console.error("Failed to create preview block:", error);
    }

    this.isLoading = false;
  }

  onMouseHover(position: THREE.Vector3) {
    if (this.previewBlock && !this.isLoading) {
      this.previewBlock.position.set(position.x, position.y, position.z);
    }
  }

  rotateBlock() {
    if (this.previewBlock && !this.isLoading) {
      const rotations = blocks[this.selectedBlockIndex].validRotations;
      const currentIndex = rotations.indexOf(this.currentRotation);
      const newIndex = Math.max((currentIndex + 1) % rotations.length, 0);
      this.currentRotation = rotations[newIndex];
      this.previewBlock.rotation.y = this.currentRotation;
    }
  }

  async onMouseClick(position: THREE.Vector3) {
    if (this.isLoading) return;

    const selectedBlock = blocks[this.selectedBlockIndex];

    try {
      let model: THREE.Group;

      if (this.loadedModels.has(selectedBlock.modelPath)) {
        model = this.loadedModels.get(selectedBlock.modelPath)!.clone();
      } else {
        const loadedModel = await loadModel(selectedBlock.modelPath);
        this.loadedModels.set(selectedBlock.modelPath, loadedModel);
        model = loadedModel.clone();
      }

      model.layers.enable(layers.raycast);
      model.position.copy(position);

      model.rotation.y = this.currentRotation;

      this.scene.add(model);
    } catch (error) {
      console.error("Failed to place block:", error);
    }
  }

  async selectBlock(index: number) {
    if (
      index >= 0 &&
      index < blocks.length &&
      index !== this.selectedBlockIndex
    ) {
      this.selectedBlockIndex = index;
      await this.createPreviewBlock();
    }
  }

  resetRotation() {
    this.currentRotation = 0;
    if (this.previewBlock) {
      this.previewBlock.rotation.y = 0;
    }
  }
}
