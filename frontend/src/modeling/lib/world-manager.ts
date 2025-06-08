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

  onPreviewUpdate = (
    ctx: EventContext,
    oldRow: PreviewVoxels,
    previewVoxels: PreviewVoxels
  ) => {
    if (previewVoxels.world === this.world.id) {
      this.currentPreview = previewVoxels;
      this.chunkMesh.update(
        this.dbConn.db.chunk.tableCache
          .iter()
          .find((c) => c.world === this.world.id),
        this.currentPreview
      );
    }
  };

  setupChunks() {
    this.dbConn.db.chunk.tableCache.iter().forEach((chunk) => {
      const c = chunk as Chunk;
      if (c.world != this.world.id) return;
      this.chunkMesh.update(c, this.currentPreview);
    });
  }

  onChunkUpdate = (ctx: EventContext, oldRow: Chunk, newRow: Chunk) => {
    this.chunkMesh.update(newRow, this.currentPreview);
  };

  dispose() {}
}
