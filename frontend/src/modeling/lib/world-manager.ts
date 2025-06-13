import * as THREE from "three";
import {
  BlockModificationMode,
  Chunk,
  DbConnection,
  EventContext,
  World,
} from "../../module_bindings";
import { ChunkMesh } from "./chunk-mesh";
import { GridRaycaster } from "./grid-raycaster";
import { Builder } from "./builder";

export class WorldManager {
  private scene: THREE.Scene;
  private chunkMesh: ChunkMesh;
  private dbConn: DbConnection;
  private world: World;
  private currentUpdateController: AbortController | null = null;
  private raycaster: GridRaycaster | null = null;
  private builder: Builder;
  private currentChunk: Chunk | null = null;

  constructor(
    scene: THREE.Scene,
    dbConn: DbConnection,
    world: World,
    camera: THREE.Camera,
    container: HTMLElement
  ) {
    this.dbConn = dbConn;
    this.scene = scene;
    this.world = world;
    this.chunkMesh = new ChunkMesh(scene);
    this.setupEvents();
    this.builder = new Builder(
      this.dbConn,
      this.world.id,
      world.dimensions,
      container,
      this.onPreviewUpdate
    );
    this.setupRaycaster(camera, container);
    this.setupChunks();
  }

  setupEvents = () => {
    this.dbConn.db.chunk.onUpdate(this.onChunkUpdate);
  };

  setupChunks = async () => {
    for (const chunk of this.dbConn.db.chunk.tableCache.iter()) {
      const c = chunk as Chunk;
      if (c.world !== this.world.id) continue;
      this.currentChunk = c;
      await this.updateChunkMesh();
    }
  };

  onPreviewUpdate = () => {
    this.updateChunkMesh();
  };

  private setupRaycaster(camera: THREE.Camera, container: HTMLElement): void {
    if (this.raycaster) {
      this.raycaster.dispose();
      this.raycaster = null;
    }

    this.raycaster = new GridRaycaster(camera, this.scene, container, {
      onHover: (position) => {
        if (position) {
          this.builder.onMouseHover(position);
        }
      },
      onClick: (position) => {
        if (position) {
          this.builder.onMouseClick(position);
        }
      },
    });
  }

  onChunkUpdate = async (ctx: EventContext, oldRow: Chunk, newRow: Chunk) => {
    this.currentChunk = newRow;
    await this.updateChunkMesh();
  };

  private async updateChunkMesh(): Promise<void> {
    if (!this.currentChunk) return;

    this.currentUpdateController = new AbortController();

    try {
      await this.chunkMesh.update(
        this.currentChunk,
        this.builder.previewBlocks,
        this.builder.getTool(),
        this.currentUpdateController.signal
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Chunk mesh update error:", error);
      }
    }
  }

  public setTool(tool: BlockModificationMode): void {
    this.builder.setTool(tool);
    if (this.raycaster) {
      this.raycaster.setTool(tool);
    }
  }

  dispose() {
    if (this.currentUpdateController) {
      this.currentUpdateController.abort();
      this.currentUpdateController = null;
    }

    this.raycaster?.dispose();
    this.chunkMesh.dispose();
    this.dbConn.db.chunk.removeOnUpdate(this.onChunkUpdate);
  }
}
