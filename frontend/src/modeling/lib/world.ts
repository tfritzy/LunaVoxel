import { Block, blocks, createBlockModel } from "../blocks";
import * as THREE from "three";
import { layers } from "./layers";
import { Chunk, DbConnection, EventContext } from "../../module_bindings";

export class World {
  private previewBlock: THREE.Object3D | null = null;
  private scene: THREE.Scene;
  private selectedBlockIndex: number = 1;
  private ghostMaterial: THREE.Material;
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
    this.setupEvents();
  }

  onQueriesApplied() {
    this.initBlocks();
  }

  private initBlocks = () => {
    for (const chunk of this.dbConn.db.chunk.iter()) {
      this.updateChunk(chunk);
    }
  };

  async updateChunk(chunk: Chunk) {
    if (!this.chunks.has(chunk.id)) {
      this.chunks.set(chunk.id, { blocks: [] });
    }
    const existingChunk = this.chunks.get(chunk.id)!;

    let i = 0;
    for (let rbIndex = 0; rbIndex < chunk.blocks.length; rbIndex++) {
      const blockRun = chunk.blocks[rbIndex];
      if (blockRun.type.tag != "Empty") {
        for (let z = i; z < i + blockRun.count; z++) {
          if (!existingChunk.blocks[z]) {
            const block = await this.createBlock(
              blocks[0],
              new THREE.Vector3(chunk.x, z, chunk.y),
              layers.raycast
            );
            existingChunk.blocks[z] = block;
          }
        }
      }
      i += blockRun.count;
    }
  }

  setupEvents = () => {
    console.log("World event setup");
    this.dbConn.db.chunk.onUpdate(this.onUpdate);
  };

  onUpdate = (_ctx: EventContext, oldChunk: Chunk, newChunk: Chunk) => {
    this.updateChunk(newChunk);
  };

  private async createBlock(
    block: Block,
    position: THREE.Vector3,
    layer: number,
    material?: THREE.Material
  ): Promise<THREE.Object3D<THREE.Object3DEventMap> | null> {
    const model = createBlockModel(block.type);

    if (!model) return null;

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (material) child.material = material;
        child.layers.set(layer);
      }
    });

    model.position.copy(position);
    model.position.y += 0.5;
    model.rotation.y = this.currentRotation;
    this.scene.add(model);
    return model;
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
