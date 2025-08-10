import * as THREE from "three";
import {
  Atlas,
  BlockModificationMode,
  DbConnection,
  EventContext,
  Layer,
  Project,
  ProjectBlocks,
} from "../../module_bindings";
import { CursorManager, PlayerCursor } from "./cursor-manager";
import { Builder } from "./builder";
import { ChunkManager } from "./chunk-manager";

export class ProjectManager {
  public builder;
  private chunkManager;
  private cursorManager: CursorManager;
  private dbConn: DbConnection;
  private project: Project;
  private layers: Layer[] = [];
  private atlas: Atlas | null = null;
  private blocks: ProjectBlocks | null = null;

  constructor(
    scene: THREE.Scene,
    dbConn: DbConnection,
    project: Project,
    camera: THREE.Camera,
    container: HTMLElement
  ) {
    this.dbConn = dbConn;
    this.project = project;
    this.chunkManager = new ChunkManager(scene, project.dimensions);
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
    this.setupLayers();
    this.setupCursors();
  }

  setSelectedBlock = (block: number) => {
    this.builder.setSelectedBlock(block);
  };

  setAtlas = (atlas: Atlas) => {
    this.atlas = atlas;
    this.updateChunkManager();
  };

  setBlocks = (blocks: ProjectBlocks) => {
    this.blocks = blocks;
    this.updateChunkManager();
  };

  setTextureAtlas = (textureAtlas: THREE.Texture | null) => {
    if (textureAtlas) {
      this.chunkManager.setTextureAtlas(textureAtlas);
      this.updateChunkManager();
    }
  };

  setupEvents = () => {
    this.dbConn.db.playerCursor.onUpdate(this.onCursorUpdate);
    this.dbConn.db.playerCursor.onInsert(this.onCursorInsert);
    this.dbConn.db.playerCursor.onDelete(this.onCursorDelete);
  };

  setupLayers = async () => {
    this.layers = (this.dbConn.db.layer.tableCache.iter() as Layer[]).filter(
      (l) => l.projectId === this.project.id
    );
    await this.updateChunkManager();
  };

  updateLayers = async (layers: Layer[]) => {
    this.layers = layers;
    await this.updateChunkManager();
  };

  setupCursors = () => {
    this.cursorManager.updateFromDatabase(this.dbConn);
  };

  onPreviewUpdate = () => {
    this.updateChunkManager();
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

  private updateChunkManager = () => {
    if (!this.atlas || !this.blocks) return;

    const start = performance.now();

    this.chunkManager.update(
      this.layers,
      this.builder.previewBlocks,
      this.builder.getTool(),
      this.blocks,
      this.atlas
    );

    const end = performance.now();
    console.log(`ChunkManager update time: ${end - start} ms`);
  };

  public setTool(tool: BlockModificationMode): void {
    this.builder.setTool(tool);
  }

  dispose(): void {
    this.builder.dispose();
    this.chunkManager.dispose();
    this.cursorManager.dispose();
    this.dbConn.db.playerCursor.removeOnUpdate(this.onCursorUpdate);
    this.dbConn.db.playerCursor.removeOnInsert(this.onCursorInsert);
    this.dbConn.db.playerCursor.removeOnDelete(this.onCursorDelete);
  }
}
