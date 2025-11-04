import * as THREE from "three";
import { DbConnection, Project, BlockModificationMode } from "../../module_bindings";
import type { ToolType } from "./tool-type";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { Chunk } from "./chunk";
import { ExportType, ModelExporter } from "../export/model-exporter";
import { EditHistory } from "./edit-history";
import { AtlasData } from "@/lib/useAtlas";
import { getBlockType } from "./voxel-data-utils";

export class ProjectManager {
  public builder;
  private chunkManager;
  private cursorManager: CursorManager;
  private dbConn: DbConnection;
  private project: Project;
  private atlasData: AtlasData | null = null;
  private editHistory: EditHistory;
  private keydownHandler: (event: KeyboardEvent) => void;

  constructor(
    scene: THREE.Scene,
    dbConn: DbConnection,
    project: Project,
    camera: THREE.Camera,
    container: HTMLElement
  ) {
    this.dbConn = dbConn;
    this.project = project;
    this.chunkManager = new Chunk(
      scene,
      project.dimensions,
      dbConn,
      project.id
    );
    this.cursorManager = new CursorManager(scene, project.id, dbConn);
    this.editHistory = new EditHistory(dbConn, project.id);
    this.keydownHandler = this.setupKeyboardEvents();

    this.builder = new Builder(
      this.dbConn,
      this.project.id,
      project.dimensions,
      camera,
      scene,
      container,
      this
    );
  }

  public onLocalCursorUpdate = (
    position: THREE.Vector3,
    normal: THREE.Vector3
  ) => {
    this.cursorManager.updateLocalCursor(position, normal);
  };

  public undo = (): void => {
    this.editHistory.undo();
  };

  public redo = (): void => {
    this.editHistory.redo();
  };

  private setupKeyboardEvents = () => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if ((event.shiftKey && event.key === "Z") || event.key === "y") {
          event.preventDefault();
          this.editHistory.redo();
        } else if (event.key === "z") {
          event.preventDefault();
          this.editHistory.undo();
        }
      } else if (event.key === "Delete") {
        event.preventDefault();
        this.dbConn.reducers.deleteSelection(this.project.id);
      }
    };

    window.addEventListener("keydown", handler);
    return handler;
  };

  public export = (type: ExportType): void => {
    const exporter = new ModelExporter(
      this.chunkManager,
      this.project,
      this.atlasData
    );
    exporter.export(type);
  };

  applyEdit = (
    layer: number,
    beforeDiff: Uint8Array,
    afterDiff: Uint8Array
  ) => {
    this.dbConn.reducers.undoEdit(
      this.project.id,
      beforeDiff,
      afterDiff,
      layer
    );
  };

  setAtlasData = (atlasData: AtlasData) => {
    this.atlasData = atlasData;
    if (atlasData) {
      this.chunkManager.setTextureAtlas(atlasData, this.builder.getMode());
      this.updateChunkManager();
    }
  };

  setSelectedBlock = (block: number) => {
    this.builder.setSelectedBlock(block, () => {});
  };

  onPreviewUpdate = () => {
    this.updateChunkManager();
  };

  public applyOptimisticRectEdit = (
    layerIndex: number,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) => {
    const layer = this.chunkManager.getLayer(layerIndex);
    if (!layer) return;
    
    // Note: Optimistic updates are no longer supported with chunk-based storage
    // The server will handle updates and we'll receive them via subscriptions
    this.updateChunkManager();
  };

  public getBlockAtPosition(
    position: THREE.Vector3,
    layerIndex: number
  ): number | null {
    // Note: Getting block at position is not directly supported with chunk-based storage
    // We would need to implement a method to query chunks
    return null;
  }

  private updateChunkManager = () => {
    if (!this.atlasData) return;
    const start = performance.now();

    this.chunkManager.update(
      this.builder.previewFrame,
      this.builder.getMode(),
      this.atlasData
    );

    const end = performance.now();
    console.log(`ChunkManager update time: ${end - start} ms`);
  };  

  dispose(): void {
    this.builder.dispose();
    this.chunkManager.dispose();
    this.cursorManager.dispose();
    window.removeEventListener("keydown", this.keydownHandler);
  }
}
