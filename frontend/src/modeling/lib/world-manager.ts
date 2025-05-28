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
  private currentPreview: PreviewVoxels | null = null;

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
      this.currentPreview = previewVoxels;
      this.updateAllChunksWithPreview();
    }
  };

  setupChunks() {
    this.dbConn.db.chunk.tableCache.iter().forEach((chunk) => {
      const c = chunk as Chunk;
      if (!this.chunkMeshes.has(c.x + "_" + c.y)) {
        const chunkManager = new ChunkMesh(this.scene, 1, 1, this.world.height);
        chunkManager.update(c, this.currentPreview);
        this.chunkMeshes.set(c.x + "_" + c.y, chunkManager);
      }
    });
  }

  onChunkUpdate = (ctx: EventContext, oldRow: Chunk, newRow: Chunk) => {
    const chunkKey = newRow.x + "_" + newRow.y;
    const chunkMesh = this.chunkMeshes.get(chunkKey);
    if (chunkMesh) {
      chunkMesh.update(newRow, this.getPreviewForChunk(newRow.x, newRow.y));
    }
  };

  private updateAllChunksWithPreview() {
    this.chunkMeshes.forEach((chunkMesh, chunkKey) => {
      const [x, y] = chunkKey.split("_").map(Number);
      const chunk = this.dbConn.db.chunk.tableCache
        .iter()
        .find((c) => c.x === x && c.y === y);
      if (chunk) {
        chunkMesh.update(chunk, this.getPreviewForChunk(x, y));
      }
    });
  }

  private getPreviewForChunk(
    chunkX: number,
    chunkY: number
  ): PreviewVoxels | null {
    if (
      !this.currentPreview ||
      this.currentPreview.previewPositions.length === 0
    ) {
      return null;
    }

    const chunkPositions = this.currentPreview.previewPositions.filter(
      (pos) => pos.x === chunkX && pos.y === chunkY
    );

    if (chunkPositions.length === 0) {
      return null;
    }

    return {
      ...this.currentPreview,
      previewPositions: chunkPositions,
    };
  }

  dispose() {}
}
