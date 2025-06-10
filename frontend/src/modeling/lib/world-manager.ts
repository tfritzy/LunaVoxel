import * as THREE from "three";
import {
  Chunk,
  DbConnection,
  EventContext,
  PreviewVoxels,
  World,
} from "../../module_bindings";
import { ChunkMesh } from "./chunk-mesh";

export class WorldManager {
  private scene: THREE.Scene;
  private chunkMesh: ChunkMesh;
  private dbConn: DbConnection;
  private world: World;
  private currentPreview: PreviewVoxels | null = null;
  private currentUpdateController: AbortController | null = null;

  constructor(scene: THREE.Scene, dbConn: DbConnection, world: World) {
    this.dbConn = dbConn;
    this.scene = scene;
    this.world = world;
    this.chunkMesh = new ChunkMesh(scene);
    this.setupEvents();
    this.setupChunks();
  }

  setupEvents = () => {
    this.dbConn.db.chunk.onUpdate(this.onChunkUpdate);
    this.dbConn.db.previewVoxels.onUpdate(this.onPreviewUpdate);
  };

  onPreviewUpdate = async (
    ctx: EventContext,
    oldRow: PreviewVoxels,
    previewVoxels: PreviewVoxels
  ) => {
    console.log("preview update");
    if (previewVoxels.world === this.world.id) {
      this.currentPreview = previewVoxels;

      const chunk = this.dbConn.db.chunk.tableCache
        .iter()
        .find((c) => c.world === this.world.id);

      if (chunk) {
        await this.updateChunkMesh(chunk, this.currentPreview);
      }
    }
  };

  setupChunks = async () => {
    for (const chunk of this.dbConn.db.chunk.tableCache.iter()) {
      const c = chunk as Chunk;
      if (c.world !== this.world.id) continue;
      await this.updateChunkMesh(c, this.currentPreview);
    }
  };

  onChunkUpdate = async (ctx: EventContext, oldRow: Chunk, newRow: Chunk) => {
    await this.updateChunkMesh(newRow, this.currentPreview);
  };

  private async updateChunkMesh(
    chunk: Chunk,
    preview: PreviewVoxels | null
  ): Promise<void> {
    const startTime = new Date();
    if (this.currentUpdateController) {
      console.log("cancel update");
      this.currentUpdateController.abort();
    }

    this.currentUpdateController = new AbortController();

    try {
      await this.chunkMesh.update(
        chunk,
        preview,
        this.currentUpdateController.signal
      );
      console.log(
        "update took",
        (new Date().getUTCMilliseconds() - startTime.getUTCMilliseconds()) /
          1000
      );
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Chunk mesh update error:", error);
      }
    }
  }

  dispose() {
    if (this.currentUpdateController) {
      this.currentUpdateController.abort();
      this.currentUpdateController = null;
    }

    this.chunkMesh.dispose();
    this.dbConn.db.chunk.removeOnUpdate(this.onChunkUpdate);
    this.dbConn.db.previewVoxels.removeOnUpdate(this.onPreviewUpdate);
  }
}
