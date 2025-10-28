import * as THREE from "three";
import { ToolType, DbConnection, Project } from "../../module_bindings";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { LegacyChunk } from "./legacy-chunk";
import { ExportType, ModelExporter } from "../export/model-exporter";
import { EditHistory } from "./edit-history";
import { AtlasData } from "@/lib/useAtlas";
import { getBlockType } from "./voxel-data-utils";
import { Chunk } from "./chunk";

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
    const chunk = new Chunk();
    this.dbConn = dbConn;
    this.project = project;
    this.chunkManager = new LegacyChunk(
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
      this.chunkManager.setTextureAtlas(atlasData, this.builder.getTool());
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
    tool: ToolType,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) => {
    const layer = this.chunkManager.getLayer(layerIndex);
    if (!layer) return;
    const previousVoxels = new Uint32Array(layer.voxels);
    this.chunkManager.applyOptimisticRect(
      layer,
      tool,
      start,
      end,
      blockType,
      rotation
    );
    const updated = new Uint32Array(layer.voxels);
    this.editHistory.addEntry(previousVoxels, updated, layer.index);
    this.updateChunkManager();
  };

  public getBlockAtPosition(
    position: THREE.Vector3,
    layerIndex: number
  ): number | null {
    const layer = this.chunkManager.getLayer(layerIndex);
    if (!layer) return null;

    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    const z = Math.floor(position.z);

    if (
      x < 0 ||
      x >= layer.xDim ||
      y < 0 ||
      y >= layer.yDim ||
      z < 0 ||
      z >= layer.zDim
    ) {
      return null;
    }

    const index = x * layer.yDim * layer.zDim + y * layer.zDim + z;
    const blockValue = layer.voxels[index];
    return getBlockType(blockValue);
  }

  private updateChunkManager = () => {
    if (!this.atlasData) return;
    const start = performance.now();

    this.chunkManager.update(
      this.builder.previewBlocks,
      this.builder.getTool(),
      this.atlasData
    );

    const end = performance.now();
    console.log(`ChunkManager update time: ${end - start} ms`);
  };

  public setTool(tool: ToolType): void {
    this.builder.setTool(tool);
  }

  dispose(): void {
    this.builder.dispose();
    this.chunkManager.dispose();
    this.cursorManager.dispose();
    window.removeEventListener("keydown", this.keydownHandler);
  }
}
