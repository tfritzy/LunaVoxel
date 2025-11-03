import * as THREE from "three";
import type { ToolType, DbConnection, Vector3 } from "../../module_bindings";
import type { ProjectManager } from "./project-manager";
import type { VoxelFrame } from "./voxel-frame";
import type { BuildMode } from "./build-mode";

export interface ToolContext {
  dbConn: DbConnection;
  projectId: string;
  dimensions: Vector3;
  projectManager: ProjectManager;
  previewFrame: VoxelFrame;
  selectedBlock: number;
  selectedLayer: number;
  setSelectedBlockInParent: (index: number) => void;
  mode: BuildMode;
}

export interface Tool {
  getType(): ToolType;

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode: BuildMode
  ): THREE.Vector3;

  onMouseDown(context: ToolContext, position: THREE.Vector3): void;

  onDrag(
    context: ToolContext,
    startPos: THREE.Vector3,
    currentPos: THREE.Vector3
  ): void;

  onMouseUp(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void;
}
