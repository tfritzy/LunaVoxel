import * as THREE from "three";
import type { BlockModificationMode, Project, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { CursorManager } from "./cursor-manager";
import { Builder } from "./builder";
import { ChunkManager } from "./chunk-manager";
import { ExportType, ModelExporter } from "../export/model-exporter";
import { editHistory } from "@/state/edit-history-instance";
import { AtlasData } from "@/lib/useAtlas";

export class ProjectManager {
  public builder;
  public chunkManager;
  private scene: THREE.Scene;
  private cursorManager: CursorManager;
  private stateStore: StateStore;
  private project: Project;
  private atlasData: AtlasData | null = null;
  private keydownHandler: (event: KeyboardEvent) => void;
  private moveSelectionBoxHelper: THREE.Box3Helper | null = null;

  constructor(
    scene: THREE.Scene,
    stateStore: StateStore,
    project: Project,
    camera: THREE.Camera,
    container: HTMLElement
  ) {
    this.scene = scene;
    this.stateStore = stateStore;
    this.project = project;
    this.chunkManager = new ChunkManager(
      scene,
      project.dimensions,
      stateStore,
      project.id,
      () => this.builder.getMode()
    );
    this.cursorManager = new CursorManager(scene);
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
    editHistory.undo();
  };

  public redo = (): void => {
    editHistory.redo();
  };

  private setupKeyboardEvents = () => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if ((event.shiftKey && event.key === "Z") || event.key === "y") {
          event.preventDefault();
          editHistory.redo();
        } else if (event.key === "z") {
          event.preventDefault();
          editHistory.undo();
        } else if (event.key === "a" || event.key === "A") {
          event.preventDefault();
          this.stateStore.reducers.selectAllVoxels(
            this.project.id,
            this.builder.getSelectedObject()
          );
        }
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        this.stateStore.reducers.deleteSelectedVoxels(
          this.project.id,
          this.builder.getSelectedObject()
        );
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
    object: number,
    beforeDiff: Uint8Array,
    afterDiff: Uint8Array
  ) => {
    this.stateStore.reducers.undoEdit(
      this.project.id,
      beforeDiff,
      afterDiff,
      object
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
    objectIndex: number,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) => {
    const obj = this.chunkManager.getObject(objectIndex);
    if (!obj) return;

    this.chunkManager.applyOptimisticRect(
      obj,
      mode,
      start,
      end,
      blockType,
      rotation
    );
  };

  public getBlockAtPosition(
    position: THREE.Vector3,
    objectIndex: number
  ): number | null {
    const obj = this.chunkManager.getObject(objectIndex);
    if (!obj) return null;

    return this.chunkManager.getBlockAtPosition(position, obj);
  }

  public updateMoveSelectionBox = (
    bounds: { min: Vector3; max: Vector3 } | null,
    offset: THREE.Vector3 = new THREE.Vector3()
  ) => {
    if (!bounds) {
      this.clearMoveSelectionBox();
      return;
    }

    if (!this.moveSelectionBoxHelper) {
      this.moveSelectionBoxHelper = new THREE.Box3Helper(
        new THREE.Box3(),
        0x44ff88
      );
      this.scene.add(this.moveSelectionBoxHelper);
    }

    this.moveSelectionBoxHelper.box.min.set(
      bounds.min.x + offset.x,
      bounds.min.y + offset.y,
      bounds.min.z + offset.z
    );
    this.moveSelectionBoxHelper.box.max.set(
      bounds.max.x + offset.x,
      bounds.max.y + offset.y,
      bounds.max.z + offset.z
    );
    this.moveSelectionBoxHelper.updateMatrixWorld(true);
  };

  public clearMoveSelectionBox = () => {
    if (!this.moveSelectionBoxHelper) return;
    this.scene.remove(this.moveSelectionBoxHelper);
    this.moveSelectionBoxHelper.geometry.dispose();
    (this.moveSelectionBoxHelper.material as THREE.Material).dispose();
    this.moveSelectionBoxHelper = null;
  };

  dispose(): void {
    this.clearMoveSelectionBox();
    this.builder.dispose();
    this.chunkManager.dispose();
    this.cursorManager.dispose();
    window.removeEventListener("keydown", this.keydownHandler);
  }
}
