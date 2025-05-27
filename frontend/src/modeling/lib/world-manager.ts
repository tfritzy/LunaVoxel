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
  private chunkMeshes: Map<string, ChunkMesh>;
  private dbConn: DbConnection;
  private world: World;

  constructor(scene: THREE.Scene, dbConn: DbConnection, world: World) {
    this.dbConn = dbConn;
    this.scene = scene;
    this.world = world;
    this.chunkMeshes = new Map();
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
      this.chunkMeshes.forEach((chunkMesh, chunkKey) => {
        const [x, y] = chunkKey.split("_").map(Number);

        const chunkPositions = previewVoxels.previewPositions.filter(
          (pos) => pos.x === x && pos.y === y
        );

        const chunkPreview =
          chunkPositions.length > 0
            ? {
                ...previewVoxels,
                previewPositions: chunkPositions,
              }
            : null;

        chunkMesh.updatePreview(chunkPreview);
      });
    }
  };

  setupChunks() {
    this.dbConn.db.chunk.tableCache.iter().forEach((chunk) => {
      const c = chunk as Chunk;
      if (!this.chunkMeshes.has(c.x + "_" + c.y)) {
        const chunkManager = new ChunkMesh(this.scene, 1, 1, this.world.height);
        chunkManager.update(c);
        this.chunkMeshes.set(c.x + "_" + c.y, chunkManager);
      }
    });
  }

  onChunkUpdate = (ctx: EventContext, oldRow: Chunk, newRow: Chunk) => {
    this.chunkMeshes.get(newRow.x + "_" + newRow.y)!.update(newRow);
  };

  dispose() {}
}
