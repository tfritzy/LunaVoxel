import * as THREE from "three";
import type { Project } from "@/state/types";
import type { StateStore } from "@/state/store";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { OctreeManager } from "./octree-manager";
import { ExportType, ModelExporter } from "../export/model-exporter";
import { EditHistory } from "./edit-history";
import { AtlasData } from "@/lib/useAtlas";

export class ProjectManager {
  public builder;
  public octreeManager;
  private cursorManager: CursorManager;
  private stateStore: StateStore;
  private project: Project;
  private atlasData: AtlasData | null = null;
  private editHistory: EditHistory;
  private keydownHandler: (event: KeyboardEvent) => void;

  constructor(
    scene: THREE.Scene,
    stateStore: StateStore,
    project: Project,
    camera: THREE.Camera,
    container: HTMLElement
  ) {
    this.stateStore = stateStore;
    this.project = project;
    this.octreeManager = new OctreeManager(
      scene,
      project.dimensions,
      stateStore,
      project.id,
    );
    this.cursorManager = new CursorManager(scene);
    this.editHistory = new EditHistory(stateStore, project.id);
    this.keydownHandler = this.setupKeyboardEvents();

    this.builder = new Builder(
      this.stateStore,
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
      this.octreeManager,
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
    this.stateStore.reducers.undoEdit(
      this.project.id,
      beforeDiff,
      afterDiff,
      layer
    );
  };

  setAtlasData = (atlasData: AtlasData) => {
    this.atlasData = atlasData;
    if (atlasData) {
      this.octreeManager.setTextureAtlas(atlasData);
    }
  };

  setSelectedBlock = (block: number) => {
    this.builder.setSelectedBlock(block, () => {});
  };

  public getBlockAtPosition(
    position: THREE.Vector3,
    layerIndex: number
  ): number | null {
    const layer = this.octreeManager.getLayer(layerIndex);
    if (!layer) return null;

    return this.octreeManager.getBlockAtPosition(position, layer);
  }

  dispose(): void {
    this.builder.dispose();
    this.octreeManager.dispose();
    this.cursorManager.dispose();
    window.removeEventListener("keydown", this.keydownHandler);
  }
}
