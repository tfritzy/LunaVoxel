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
  private playerPreviews: Map<string, PreviewVoxels> = new Map();

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
    this.dbConn.db.previewVoxels.onInsert(this.onPreviewInsert);
    this.dbConn.db.previewVoxels.onUpdate(this.onPreviewUpdate);
    this.dbConn.db.previewVoxels.onDelete(this.onPreviewDelete);
  };

  onPreviewInsert = (ctx: EventContext, previewVoxels: PreviewVoxels) => {
    if (previewVoxels.world === this.world.id) {
      this.playerPreviews.set(
        previewVoxels.player.toHexString(),
        previewVoxels
      );
      this.updateAffectedChunks(previewVoxels);
    }
  };

  onPreviewUpdate = (
    ctx: EventContext,
    oldRow: PreviewVoxels,
    previewVoxels: PreviewVoxels
  ) => {
    if (previewVoxels.world === this.world.id) {
      this.playerPreviews.set(
        previewVoxels.player.toHexString(),
        previewVoxels
      );
      const affectedChunks = new Set<string>();

      oldRow.previewPositions.forEach((pos) => {
        affectedChunks.add(`${pos.x}_${pos.y}`);
      });
      previewVoxels.previewPositions.forEach((pos) => {
        affectedChunks.add(`${pos.x}_${pos.y}`);
      });

      affectedChunks.forEach((chunkKey) => {
        const [x, y] = chunkKey.split("_").map(Number);
        this.updateChunk(x, y);
      });
    }
  };

  onPreviewDelete = (ctx: EventContext, previewVoxels: PreviewVoxels) => {
    if (previewVoxels.world === this.world.id) {
      this.playerPreviews.delete(previewVoxels.player.toHexString());
      this.updateAffectedChunks(previewVoxels);
    }
  };

  private updateAffectedChunks(previewVoxels: PreviewVoxels) {
    const affectedChunks = new Set<string>();
    previewVoxels.previewPositions.forEach((pos) => {
      affectedChunks.add(`${pos.x}_${pos.y}`);
    });

    affectedChunks.forEach((chunkKey) => {
      const [x, y] = chunkKey.split("_").map(Number);
      this.updateChunk(x, y);
    });
  }

  private updateChunk(x: number, y: number) {
    const chunkKey = `${x}_${y}`;
    const chunkMesh = this.chunkMeshes.get(chunkKey);
    const chunk = this.dbConn.db.chunk.tableCache
      .iter()
      .find((c) => c.x === x && c.y === y);

    if (chunkMesh && chunk) {
      const previewMap = this.getMergedPreviewsForChunk(x, y);
      chunkMesh.update(chunk, previewMap);
    }
  }

  setupChunks() {
    this.dbConn.db.chunk.tableCache.iter().forEach((chunk) => {
      const c = chunk as Chunk;
      if (!this.chunkMeshes.has(c.x + "_" + c.y)) {
        const chunkManager = new ChunkMesh(this.scene, 1, 1, this.world.height);
        const previewMap = this.getMergedPreviewsForChunk(c.x, c.y);
        chunkManager.update(c, previewMap);
        this.chunkMeshes.set(c.x + "_" + c.y, chunkManager);
      }
    });
  }

  onChunkUpdate = (ctx: EventContext, oldRow: Chunk, newRow: Chunk) => {
    const chunkKey = newRow.x + "_" + newRow.y;
    const chunkMesh = this.chunkMeshes.get(chunkKey);
    if (chunkMesh) {
      const previewMap = this.getMergedPreviewsForChunk(newRow.x, newRow.y);
      chunkMesh.update(newRow, previewMap);
    }
  };

  private getMergedPreviewsForChunk(
    chunkX: number,
    chunkY: number
  ): Map<string, { color: string; isAddMode: boolean }> {
    const mergedPreviews = new Map<
      string,
      { color: string; isAddMode: boolean }
    >();

    this.playerPreviews.forEach((preview) => {
      preview.previewPositions.forEach((pos) => {
        if (pos.x === chunkX && pos.y === chunkY) {
          const key = `${pos.x},${pos.y},${pos.z}`;
          mergedPreviews.set(key, {
            color: preview.blockColor,
            isAddMode: preview.isAddMode,
          });
        }
      });
    });

    return mergedPreviews;
  }

  dispose() {
    this.playerPreviews.clear();
  }
}
