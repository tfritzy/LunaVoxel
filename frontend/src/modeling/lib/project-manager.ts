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
import { LayerMesh } from "./layer-mesh";
import { CursorManager, PlayerCursor } from "./cursor-manager";
import { Builder } from "./builder";

export class ProjectManager {
  public builder;
  private scene: THREE.Scene;
  private layerMesh;
  private cursorManager: CursorManager;
  private dbConn: DbConnection;
  private project: Project;
  private currentUpdateController: AbortController | null = null;
  private currentLayer: Layer | null = null;
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
    this.scene = scene;
    this.project = project;
    this.layerMesh = new LayerMesh(scene);
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
    this.updateLayerMesh();
  };

  setBlocks = (blocks: ProjectBlocks) => {
    this.blocks = blocks;
    this.updateLayerMesh();
  };

  setTextureAtlas = (textureAtlas: THREE.Texture | null) => {
    if (textureAtlas) {
      this.layerMesh.setTextureAtlas(textureAtlas);
      this.updateLayerMesh();
    }
  };

  setupEvents = () => {
    this.dbConn.db.layer.onUpdate(this.onLayerUpdate);
    this.dbConn.db.playerCursor.onUpdate(this.onCursorUpdate);
    this.dbConn.db.playerCursor.onInsert(this.onCursorInsert);
    this.dbConn.db.playerCursor.onDelete(this.onCursorDelete);
  };

  setupLayers = async () => {
    for (const layer of this.dbConn.db.layer.tableCache.iter()) {
      const l = layer as Layer;
      if (l.projectId !== this.project.id) continue;
      this.currentLayer = l;
      await this.updateLayerMesh();
    }
  };

  setupCursors = () => {
    this.cursorManager.updateFromDatabase(this.dbConn);
  };

  onPreviewUpdate = () => {
    this.updateLayerMesh();
  };

  onLayerUpdate = (ctx: EventContext, oldRow: Layer, newRow: Layer) => {
    this.currentLayer = newRow;
    this.updateLayerMesh();
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

  private updateLayerMesh = () => {
    if (!this.currentLayer || !this.atlas || !this.blocks) {
      console.warn(
        "No current layer or atlas set, skipping mesh update.",
        this.currentLayer,
        this.atlas
      );
      return;
    }

    this.currentUpdateController = new AbortController();
    this.layerMesh.update(
      this.currentLayer,
      this.builder.previewBlocks,
      this.builder.getTool(),
      this.atlas,
      this.blocks
    );
  };

  public setTool(tool: BlockModificationMode): void {
    this.builder.setTool(tool);
  }

  dispose(): void {
    if (this.currentUpdateController) {
      this.currentUpdateController.abort();
      this.currentUpdateController = null;
    }
    this.builder.dispose();
    this.layerMesh.dispose();
    this.cursorManager.dispose();
    this.dbConn.db.layer.removeOnUpdate(this.onLayerUpdate);
    this.dbConn.db.playerCursor.removeOnUpdate(this.onCursorUpdate);
    this.dbConn.db.playerCursor.removeOnInsert(this.onCursorInsert);
    this.dbConn.db.playerCursor.removeOnDelete(this.onCursorDelete);
  }
}
