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
   * Called when the mouse button is pressed down
   * @param context Tool context
   * @param position The grid position where mouse down occurred
   */
  onMouseDown(context: ToolContext, position: THREE.Vector3): void;

  /**
   * Called when the mouse is dragged with button held down
   * @param context Tool context
   * @param startPos The position where the drag started
   * @param currentPos The current position during the drag
   */
  onDrag(
    context: ToolContext,
    startPos: THREE.Vector3,
    currentPos: THREE.Vector3
  ): void;

  /**
   * Called when the mouse button is released
   * @param context Tool context
   * @param startPos The position where the mouse was pressed down
   * @param endPos The position where the mouse was released
   */
  onMouseUp(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void;
}
