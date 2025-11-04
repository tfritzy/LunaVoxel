import * as THREE from "three";
import { DbConnection, Project, BlockModificationMode } from "../../module_bindings";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { ChunkManager } from "./chunk-manager";
import { ExportType, ModelExporter } from "../export/model-exporter";
import { EditHistory } from "./edit-history";
import { AtlasData } from "@/lib/useAtlas";

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
    this.chunkManager = new ChunkManager(
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

  // Apply optimistic rect edit to preview changes before server confirmation
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
    
    this.chunkManager.applyOptimisticRect(layer, mode, start, end, blockType, rotation);
    this.updateChunkManager();
  };

  // Get block at a specific position
  public getBlockAtPosition(
    position: THREE.Vector3,
    layerIndex: number
  ): number | null {
    const layer = this.chunkManager.getLayer(layerIndex);
    if (!layer) return null;
    
    return this.chunkManager.getBlockAtPosition(position, layer);
  }

  private updateChunkManager = () => {
    if (!this.atlasData) return;
    const start = performance.now();

    this.chunkManager.setAtlasData(this.atlasData);

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
