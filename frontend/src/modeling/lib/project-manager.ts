import * as THREE from "three";
import {
  BlockModificationMode,
  DbConnection,
  EventContext,
  Layer,
  Project,
} from "../../module_bindings";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { ChunkManager } from "./chunk-manager";
import { ExportType, ModelExporter } from "../export/model-exporter";
import { decompressVoxelData } from "./voxel-data-utils";
import { EditHistory } from "./edit-history";
import { AtlasData } from "@/lib/useAtlas";
import { getBlockType } from "./voxel-data-utils";
import { FrontendTool } from "@/lib/toolTypes";

export type DecompressedLayer = Omit<Layer, "voxels"> & { voxels: Uint32Array };

export class ProjectManager {
  public builder;
  private chunkManager;
  private cursorManager: CursorManager;
  private dbConn: DbConnection;
  private project: Project;
  private layers: DecompressedLayer[] = [];
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
    this.chunkManager = new ChunkManager(scene, project.dimensions);
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

    this.dbConn.db.layer.onInsert(this.onLayerInsert);
    this.dbConn.db.layer.onUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.onDelete(this.onLayerDelete);
    this.setupLayers();
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

  private decompressLayer = (layer: Layer): DecompressedLayer => {
    let voxels: Uint32Array;

    if (layer.voxels instanceof Uint32Array) {
      voxels = layer.voxels;
    } else if (layer.voxels instanceof Uint8Array) {
      voxels = decompressVoxelData(layer.voxels);
    } else if (Array.isArray(layer.voxels)) {
      voxels = decompressVoxelData(layer.voxels);
    } else {
      const totalSize =
        this.project.dimensions.x *
        this.project.dimensions.y *
        this.project.dimensions.z;
      voxels = new Uint32Array(totalSize);
    }

    return {
      ...layer,
      voxels,
    };
  };

  setSelectedBlock = (block: number) => {
    this.builder.setSelectedBlock(block);
  };

  setAtlasData = (atlasData: AtlasData) => {
    this.atlasData = atlasData;
    if (atlasData) {
      this.chunkManager.setTextureAtlas(atlasData, this.builder.getTool());
      this.updateChunkManager();
    }
  };

  setupLayers = () => {
    this.refreshLayers();
    this.updateChunkManager();
  };

  updateLayers = async (layers: Layer[]) => {
    this.layers = layers.map(this.decompressLayer);
    this.updateChunkManager();
  };

  private refreshLayers = () => {
    const rawLayers = (this.dbConn.db.layer.tableCache.iter() as Layer[])
      .filter((l) => l.projectId === this.project.id)
      .sort((a, b) => a.index - b.index);

    this.layers = rawLayers.map(this.decompressLayer);
  };

  private onLayerInsert = (ctx: EventContext, newLayer: Layer) => {
    if (newLayer.projectId !== this.project.id) return;
    if (this.layers.some((l) => l.id === newLayer.id)) return;

    const decompressedLayer = this.decompressLayer(newLayer);
    this.layers = [...this.layers, decompressedLayer].sort(
      (a, b) => a.index - b.index
    );
    this.updateChunkManager();
  };

  private onLayerUpdate = (
    ctx: EventContext,
    oldLayer: Layer,
    newLayer: Layer
  ) => {
    if (newLayer.projectId !== this.project.id) return;

    const decompressedLayer = this.decompressLayer(newLayer);
    this.layers = this.layers
      .map((l) => (l.id === newLayer.id ? decompressedLayer : l))
      .sort((a, b) => a.index - b.index);
    this.updateChunkManager();
  };

  private onLayerDelete = (ctx: EventContext, deletedLayer: Layer) => {
    if (deletedLayer.projectId !== this.project.id) return;
    const before = this.layers.length;
    this.layers = this.layers.filter((l) => l.id !== deletedLayer.id);
    if (this.layers.length !== before) this.updateChunkManager();
  };

  onPreviewUpdate = () => {
    this.updateChunkManager();
  };

  public applyOptimisticRectEdit = (
    layerIndex: number,
    tool: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) => {
    const layer = this.layers.find((l) => l.index === layerIndex);
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
    const layer = this.layers.find((l) => l.index === layerIndex);
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
      this.layers,
      this.builder.previewBlocks,
      this.builder.getTool(),
      this.atlasData
    );

    const end = performance.now();
    console.log(`ChunkManager update time: ${end - start} ms`);
  };

  public setTool(tool: FrontendTool): void {
    this.builder.setTool(tool);
  }

  dispose(): void {
    this.builder.dispose();
    this.chunkManager.dispose();
    this.cursorManager.dispose();
    this.dbConn.db.layer.removeOnInsert(this.onLayerInsert);
    this.dbConn.db.layer.removeOnUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.removeOnDelete(this.onLayerDelete);
    window.removeEventListener("keydown", this.keydownHandler);
  }
}
