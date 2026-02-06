import * as THREE from "three";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { ChunkManager } from "./chunk-manager";
import { ExportType, ModelExporter } from "../export/model-exporter";
import { EditHistory } from "./edit-history";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";
import { reducers, type Vector3, type BlockModificationMode } from "@/state";

export class ProjectManager {
  public builder;
  public chunkManager;
  private cursorManager: CursorManager;
  private dimensions: Vector3;
  private atlasData: AtlasData | null = null;
  private editHistory: EditHistory;
  private keydownHandler: (event: KeyboardEvent) => void;

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    camera: THREE.Camera,
    container: HTMLElement
  ) {
    this.dimensions = dimensions;
    this.chunkManager = new ChunkManager(
      scene,
      dimensions,
      () => this.builder.getMode()
    );
    this.cursorManager = new CursorManager(scene);
    this.editHistory = new EditHistory();
    this.keydownHandler = this.setupKeyboardEvents();

    this.builder = new Builder(
      dimensions,
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
      this.dimensions,
      this.atlasData
    );
    exporter.export(type);
  };

  applyEdit = (
    layer: number,
    beforeDiff: Uint8Array,
    afterDiff: Uint8Array
  ) => {
    reducers.undoEdit(
      beforeDiff,
      afterDiff,
      layer
    );
  };

  setAtlasData = (atlasData: AtlasData) => {
    this.atlasData = atlasData;
    if (atlasData) {
      this.chunkManager.setTextureAtlas(atlasData);
    }
  };

  setSelectedBlock = (block: number) => {
    this.builder.setSelectedBlock(block, () => {});
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

    this.chunkManager.applyOptimisticRect(
      layer,
      mode,
      start,
      end,
      blockType,
      rotation
    );
  };

  public getBlockAtPosition(
    position: THREE.Vector3,
    layerIndex: number
  ): number | null {
    const layer = this.chunkManager.getLayer(layerIndex);
    if (!layer) return null;

    return this.chunkManager.getBlockAtPosition(position, layer);
  }

  dispose(): void {
    this.builder.dispose();
    this.chunkManager.dispose();
    this.cursorManager.dispose();
    window.removeEventListener("keydown", this.keydownHandler);
  }
}
