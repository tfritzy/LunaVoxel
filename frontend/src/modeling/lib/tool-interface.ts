import * as THREE from "three";
import type { ToolType, DbConnection, Vector3 } from "../../module_bindings";
import type { ProjectManager } from "./project-manager";
import type { VoxelFrame } from "./voxel-frame";

/**
 * Context provided to tools for their operations
 */
export interface ToolContext {
  dbConn: DbConnection;
  projectId: string;
  dimensions: Vector3;
  projectManager: ProjectManager;
  previewFrame: VoxelFrame;
  selectedBlock: number;
  selectedLayer: number;
  setSelectedBlockInParent: (index: number) => void;
}

/**
 * Interface that all tools must implement
 */
export interface Tool {
  /**
   * Get the ToolType identifier for this tool
   */
  getType(): ToolType;

  /**
   * Calculate the grid position offset for raycasting
   * @param intersectionPoint The raw intersection point
   * @param normal The face normal
   * @returns The adjusted grid position
   */
  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3
  ): THREE.Vector3;

  /**
   * Whether this tool should show a preview
   */
  shouldShowPreview(): boolean;

  /**
   * Preview the tool's effect at the given position(s)
   * @param context Tool context
   * @param startPos Starting position
   * @param endPos Ending position
   */
  preview(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void;

  /**
   * Execute the tool's action
   * @param context Tool context
   * @param startPos Starting position
   * @param endPos Ending position
   */
  execute(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void;
}
