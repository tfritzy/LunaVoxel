import * as THREE from "three";
import type { DbConnection, Vector3, BlockModificationMode } from "../../module_bindings";
import type { ToolType } from "./tool-type";
import type { ProjectManager } from "./project-manager";
import type { VoxelFrame } from "./voxel-frame";

export interface ToolContext {
  dbConn: DbConnection;
  projectId: string;
  dimensions: Vector3;
  projectManager: ProjectManager;
  previewFrame: VoxelFrame;
  selectedBlock: number;
  selectedLayer: number;
  setSelectedBlockInParent: (index: number) => void;
  mode: BlockModificationMode;
}

export interface Tool {
  getType(): ToolType;

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
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
