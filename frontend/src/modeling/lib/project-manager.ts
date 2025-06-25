import * as THREE from "three";
import {
  BlockModificationMode,
  Chunk,
  DbConnection,
  EventContext,
  Project,
} from "../../module_bindings";
import { ChunkMesh } from "./chunk-mesh";
import { CursorManager, PlayerCursor } from "./cursor-manager";
import { Builder } from "./builder";

export class ProjectManager {
  private scene: THREE.Scene;
  private chunkMesh: ChunkMesh;
  private cursorManager: CursorManager;
  private dbConn: DbConnection;
  private project: Project;
  private currentUpdateController: AbortController | null = null;
  private builder: Builder;
  private currentChunk: Chunk | null = null;

  constructor(
    scene: THREE.Scene,
    dbConn: DbConnection,
    project: Project,
    camera: THREE.Camera,
    container: HTMLElement
  ) {
    this.dbConn = dbConn;
    this.scene = scene;
    this.project = project;
    this.chunkMesh = new ChunkMesh(scene);
    this.cursorManager = new CursorManager(scene, project.id);
    this.setupEvents();
    this.builder = new Builder(
      this.dbConn,
      this.project.id,
      project.dimensions,
      camera,
      scene,
      container,
      this.onPreviewUpdate
    );
    this.setupChunks();
    this.setupCursors();
  }

  public setSelectedColor(color: number): void {
    this.builder.setSelectedColor(color);
  }

  setupEvents = () => {
    this.dbConn.db.chunk.onUpdate(this.onChunkUpdate);
    this.dbConn.db.playerCursor.onUpdate(this.onCursorUpdate);
    this.dbConn.db.playerCursor.onInsert(this.onCursorInsert);
    this.dbConn.db.playerCursor.onDelete(this.onCursorDelete);
  };

  setupChunks = async () => {
    for (const chunk of this.dbConn.db.chunk.tableCache.iter()) {
      const c = chunk as Chunk;
      if (c.projectId !== this.project.id) continue;
      this.currentChunk = c;
      await this.updateChunkMesh();
    }
  };

  setupCursors = () => {
    this.cursorManager.updateFromDatabase(this.dbConn);
  };

  onPreviewUpdate = () => {
    this.updateChunkMesh();
  };

  onChunkUpdate = (ctx: EventContext, oldRow: Chunk, newRow: Chunk) => {
    this.currentChunk = newRow;
    this.updateChunkMesh();
  };

  onCursorUpdate = (
    ctx: EventContext,
    oldRow: PlayerCursor,
    newRow: PlayerCursor
  ) => {
    if (newRow.projectId === this.project.id) {
      this.cursorManager.updateFromDatabase(this.dbConn);
    }
  };

  onCursorInsert = (ctx: EventContext, row: PlayerCursor) => {
    if (row.projectId === this.project.id) {
      this.cursorManager.updateFromDatabase(this.dbConn);
    }
  };

  onCursorDelete = (ctx: EventContext, row: PlayerCursor) => {
    if (row.projectId === this.project.id) {
      this.cursorManager.updateFromDatabase(this.dbConn);
    }
  };

  private updateChunkMesh(): void {
    if (!this.currentChunk) return;

    this.currentUpdateController = new AbortController();
    this.chunkMesh.update(
      this.currentChunk,
      this.builder.previewBlocks,
      this.builder.getTool()
    );
  }

  public setTool(tool: BlockModificationMode): void {
    this.builder.setTool(tool);
  }

  dispose(): void {
    if (this.currentUpdateController) {
      this.currentUpdateController.abort();
      this.currentUpdateController = null;
    }
    this.builder.dispose();
    this.chunkMesh.dispose();
    this.cursorManager.dispose();
    this.dbConn.db.chunk.removeOnUpdate(this.onChunkUpdate);
    this.dbConn.db.playerCursor.removeOnUpdate(this.onCursorUpdate);
    this.dbConn.db.playerCursor.removeOnInsert(this.onCursorInsert);
    this.dbConn.db.playerCursor.removeOnDelete(this.onCursorDelete);
  }
}
