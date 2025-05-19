import { Block, blocks, createBlockModel } from "../blocks";
import * as THREE from "three";
import { layers } from "./layers";
import { Chunk, DbConnection, EventContext } from "../../module_bindings";

export class World {
  private scene: THREE.Scene;
  private selectedBlockIndex: number = 1;
  private ghostMaterial: THREE.Material;
  private currentRotation: number = 0;
  private dbConn: DbConnection;
  private chunks: Map<
    string,
    { blocks: ({ model: THREE.Mesh; ghost: boolean } | null)[] }
  >;

  constructor(scene: THREE.Scene, dbConn: DbConnection) {
    this.chunks = new Map();
    this.dbConn = dbConn;
    this.scene = scene;
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: "#0096FF",
      opacity: 0.3,
      transparent: true,
      depthWrite: true,
      depthTest: true,
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
          if (existingChunk.blocks[z]?.ghost && !blockRun.ghost) {
            this.scene.remove(existingChunk.blocks[z]!.model);
            existingChunk.blocks[z] = null;
          }

          if (!existingChunk.blocks[z]) {
            const block = await this.createBlock(
              blocks[0],
              new THREE.Vector3(chunk.x, z, chunk.y),
              blockRun.ghost
            );
            existingChunk.blocks[z] = { model: block!, ghost: blockRun.ghost };
          }
        }
      } else {
        for (let z = i; z < i + blockRun.count; z++) {
          const objectToRemove = existingChunk.blocks[z];
          if (objectToRemove) {
            this.scene.remove(objectToRemove.model);
            existingChunk.blocks[z] = null;
          }
        }
      }
      i += blockRun.count;
    }
  }

  setupEvents = () => {
    this.dbConn.db.chunk.onUpdate(this.onUpdate);
  };

  onUpdate = (_ctx: EventContext, oldChunk: Chunk, newChunk: Chunk) => {
    this.updateChunk(newChunk);
  };

  private async createBlock(
    block: Block,
    position: THREE.Vector3,
    ghost: boolean
  ): Promise<THREE.Mesh | null> {
    const model = createBlockModel(block.type);

    if (!model) return null;
    if (ghost) {
      model.material = this.ghostMaterial;
      model.castShadow = false;
      model.layers.set(layers.ghost);
    }
    model.position.copy(position.addScalar(0.5));
    model.rotation.y = this.currentRotation;
    this.scene.add(model);
    return model;
  }

  dispose() {}
}
