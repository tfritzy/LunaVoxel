import { Block, blocks, loadModel } from "../blocks";
import * as THREE from "three";
import { layers } from "./layers";
import { Chunk, DbConnection, EventContext } from "../../module_bindings";

export class World {
  private previewBlock: THREE.Object3D | null = null;
  private scene: THREE.Scene;
  private selectedBlockIndex: number = 1;
  private ghostMaterial: THREE.Material;
  private loadedModels: Map<string, THREE.Group> = new Map();
  private currentRotation: number = 0;
  private dbConn: DbConnection;
  private chunks: Map<string, { blocks: (THREE.Object3D | null)[] }>;

  constructor(scene: THREE.Scene, dbConn: DbConnection) {
    this.chunks = new Map();
    this.dbConn = dbConn;
    this.scene = scene;
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: "#0096FF",
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
    });
    this.preloadModels();
    this.setupEvents();
  }

  setupEvents = () => {
    console.log("World event setup");
    this.dbConn.db.chunk.onUpdate(this.onUpdate);
  };

  onUpdate = (_ctx: EventContext, oldChunk: Chunk, newChunk: Chunk) => {
    console.log("chunk update called in world for", newChunk);
    if (!this.chunks.has(newChunk.id)) {
      this.chunks.set(newChunk.id, { blocks: [] });
    }
    const chunk = this.chunks.get(newChunk.id)!;
    for (let z = 0; z < newChunk.blocks.length; z++) {
      if (!chunk.blocks[z] && newChunk.blocks[z].tag !== "Empty") {
        console.log("Need to create block");
        this.createBlock(
          blocks[0],
          new THREE.Vector3(newChunk.x, newChunk.y, z),
          layers.raycast
        );
      }
    }
  };

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
  }

  private async createBlock(
    block: Block,
    position: THREE.Vector3,
    layer: number,
    material?: THREE.Material
  ) {
    let model: THREE.Group;

    if (this.loadedModels.has(block.modelPath)) {
      model = this.loadedModels.get(block.modelPath)!.clone();
    } else {
      const loadedModel = await loadModel(block.modelPath);
      this.loadedModels.set(block.modelPath, loadedModel);
      model = loadedModel.clone();
    }
    console.log("Creating block of: ", model);

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (material) child.material = material;
        child.layers.set(layer);
        child.castShadow = false;
      }
    });

    model.position.copy(position);
    model.rotation.y = this.currentRotation;
    this.scene.add(model);
    this.previewBlock = model;
  }

  private async createPreviewBlock(position: THREE.Vector3) {
    if (this.previewBlock) {
      this.scene.remove(this.previewBlock);
      this.previewBlock = null;
    }

    const selectedBlock = blocks[this.selectedBlockIndex];
    this.createBlock(selectedBlock, position, layers.ghost, this.ghostMaterial);
  }

  async selectBlock(index: number) {
    if (
      index >= 0 &&
      index < blocks.length &&
      index !== this.selectedBlockIndex
    ) {
      this.selectedBlockIndex = index;
      await this.createPreviewBlock(
        this.previewBlock?.position || new THREE.Vector3()
      );
    }
  }

  resetRotation() {
    this.currentRotation = 0;
    if (this.previewBlock) {
      this.previewBlock.rotation.y = 0;
    }
  }

  dispose() {
    if (this.previewBlock) {
      this.scene.remove(this.previewBlock);
      this.previewBlock = null;
    }
  }
}
