import * as THREE from "three";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import type { Reducers } from "@/state/store";
import type { ToolType } from "./tool-type";
import type { ProjectManager } from "./project-manager";

export interface ToolContext {
  reducers: Reducers;
  projectId: string;
  dimensions: Vector3;
  projectManager: ProjectManager;
  previewBuffer: Uint8Array;
  selectedBlock: number;
  selectedObject: number;
  setSelectedBlockInParent: (index: number) => void;
  mode: BlockModificationMode;
  camera: THREE.Camera;
  scene: THREE.Scene;
}

export interface ToolMouseEvent {
  gridPosition: THREE.Vector3;
  mousePosition: THREE.Vector2;
}

export interface ToolDragEvent {
  startGridPosition: THREE.Vector3;
  currentGridPosition: THREE.Vector3;
  startMousePosition: THREE.Vector2;
  currentMousePosition: THREE.Vector2;
  shiftKey?: boolean;
}

export interface ToolOption {
  name: string;
  values: string[];
  currentValue: string;
  type?: "slider" | "direction" | "checkbox";
  min?: number;
  max?: number;
}

export interface Tool {
  getType(): ToolType;

  getOptions(): ToolOption[];

  setOption(name: string, value: string): void;

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3;

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void;

  onDrag(context: ToolContext, event: ToolDragEvent): void;

  onMouseUp(context: ToolContext, event: ToolDragEvent): void;

  hasPendingOperation?(): boolean;

  onPendingMouseDown?(context: ToolContext, mousePos: THREE.Vector2): boolean;

  onPendingMouseMove?(context: ToolContext, mousePos: THREE.Vector2, shiftKey?: boolean): void;

  onPendingMouseUp?(context: ToolContext, mousePos: THREE.Vector2): void;

  commitPendingOperation?(context: ToolContext): void;

  cancelPendingOperation?(context: ToolContext): void;

  updatePending?(context: ToolContext): void;

  dispose?(): void;
}
