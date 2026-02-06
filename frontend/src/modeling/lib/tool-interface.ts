import * as THREE from "three";
import type { ToolType } from "./tool-type";
import type { ProjectManager } from "./project-manager";
import type { VoxelFrame } from "./voxel-frame";
import type { reducers, Vector3, BlockModificationMode } from "@/state";

export interface ToolContext {
  dimensions: Vector3;
  projectManager: ProjectManager;
  previewFrame: VoxelFrame;
  selectedBlock: number;
  selectedLayer: number;
  setSelectedBlockInParent: (index: number) => void;
  mode: BlockModificationMode;
  camera: THREE.Camera;
  reducers: typeof reducers;
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
}

export interface Tool {
  getType(): ToolType;

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3;

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void;

  onDrag(context: ToolContext, event: ToolDragEvent): void;

  onMouseUp(context: ToolContext, event: ToolDragEvent): void;
}
