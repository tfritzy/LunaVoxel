import * as THREE from "three";
import {
  Atlas,
  BlockModificationMode,
  DbConnection,
  EventContext,
  Layer,
  PlayerCursor,
  Project,
  ProjectBlocks,
} from "../../module_bindings";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { ChunkManager } from "./chunk-manager";
import { BlenderExporter } from "../export/blender-exporter";
import { decompressVoxelData } from "./voxel-data-utils";
import { EditHistory } from "./edit-history";

export type DecompressedLayer = Omit<Layer, "voxels"> & { voxels: Uint32Array };

export const ProjectManager = class {
  public builder;
  private chunkManager;
  private cursorManager: CursorManager;
  private dbConn: DbConnection;
  private project: Project;
  private layers: DecompressedLayer[] = [];
  private atlas: Atlas | null = null;
  private blocks: ProjectBlocks | null = null;
  private layerSub?: { unsubscribe: () => void };
  private textureAtlas: THREE.Texture | null = null;
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
    this.cursorManager = new CursorManager(scene, project.id);
    this.editHistory = new EditHistory(this.applyEdit);
    this.keydownHandler = this.setupKeyboardEvents();
    this.setupEvents();
    this.builder = new Builder(
      this.dbConn,
      this.project.id,
      project.dimensions,
      camera,
      scene,
      container,
      this.onPreviewUpdate,
      (tool, start, end, blockType, layerIndex) => {
        this.applyOptimisticRectEdit(
          layerIndex,
          tool,
          start,
          end,
          blockType,
          0
        );
      },
      (position: THREE.Vector3, normal: THREE.Vector3) => {
        this.cursorManager.updateLocalCursor(position, normal);
      }
    );
    this.setupLayers();
    this.setupLayerSubscription();
    this.setupCursors();
  }

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

  public exportToOBJ = (): void => {
    const exporter = new BlenderExporter(
      this.chunkManager,
      this.atlas,
      this.blocks,
      this.project,
      this.textureAtlas
    );
    exporter.exportOBJ();
  };

  applyEdit = (layer: number, diff: Uint8Array) => {
    this.dbConn.reducers.modifyBlockAmorphous(this.project.id, diff, layer);
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

  setAtlas = (atlas: Atlas) => {
    this.atlas = atlas;
    this.updateChunkManager();
  };

  setBlocks = (blocks: ProjectBlocks) => {
    this.blocks = blocks;
    this.updateChunkManager();
  };

  setTextureAtlas = (textureAtlas: THREE.Texture | null) => {
    this.textureAtlas = textureAtlas;
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
    this.refreshLayers();
    await this.updateChunkManager();
  };

  private setupLayerSubscription = () => {
    this.layerSub = this.dbConn
      .subscriptionBuilder()
      .onApplied(() => {
        this.refreshLayers();
        this.updateChunkManager();
      })
      .onError((e) => console.error("Layer subscription error", e))
      .subscribe([`SELECT * FROM layer WHERE ProjectId='${this.project.id}'`]);

    this.dbConn.db.layer.onInsert(this.onLayerInsert);
    this.dbConn.db.layer.onUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.onDelete(this.onLayerDelete);
  };

  updateLayers = async (layers: Layer[]) => {
    this.layers = layers.map(this.decompressLayer);
    await this.updateChunkManager();
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

  public applyOptimisticRectEdit(
    layerIndex: number,
    tool: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) {
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
  }

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
    this.layerSub?.unsubscribe();
    this.dbConn.db.layer.removeOnInsert(this.onLayerInsert);
    this.dbConn.db.layer.removeOnUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.removeOnDelete(this.onLayerDelete);
    window.removeEventListener("keydown", this.keydownHandler);
  }
};
