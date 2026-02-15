import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class MoveSelectionTool implements Tool {
  private snappedAxis: THREE.Vector3 | null = null;
  private lastOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private isLifted: boolean = false;

  getType(): ToolType {
    return "MoveSelection";
  }

  getOptions(): ToolOption[] {
    return [];
  }

  setOption(): void {}

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3 {
    void mode;
    return calculateGridPositionWithMode(gridPosition, normal, "under");
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    void event;
    this.snappedAxis = null;
    this.lastOffset = new THREE.Vector3(0, 0, 0);
    this.isLifted = false;
    context.projectManager.updateMoveSelectionBox(context.selectedObject, this.lastOffset);
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    const offset = this.calculateOffsetFromMouseDelta(
      event.startMousePosition,
      event.currentMousePosition,
      context.camera
    );

    if (!this.isLifted && offset.length() > 0.1) {
      context.projectManager.liftSelection(context.selectedObject);
      this.isLifted = true;
    }

    this.lastOffset.copy(offset);

    if (this.isLifted) {
      context.projectManager.renderFloatingSelection(this.lastOffset);
    }

    context.projectManager.updateMoveSelectionBox(context.selectedObject, this.lastOffset);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    void event;
    if (this.isLifted) {
      if (this.lastOffset.length() > 0.1) {
        context.projectManager.commitFloatingSelection(
          context.selectedObject,
          this.lastOffset
        );
      } else {
        context.projectManager.cancelFloatingSelection();
      }
    }

    this.snappedAxis = null;
    this.lastOffset = new THREE.Vector3(0, 0, 0);
    this.isLifted = false;
    context.projectManager.updateMoveSelectionBox(context.selectedObject, this.lastOffset);
  }

  private calculateOffsetFromMouseDelta(
    startMousePos: THREE.Vector2,
    currentMousePos: THREE.Vector2,
    camera: THREE.Camera
  ): THREE.Vector3 {
    // Calculate screen-space mouse delta
    const mouseDelta = new THREE.Vector2().subVectors(currentMousePos, startMousePos);

    // Determine the snap axis if not already determined
    if (!this.snappedAxis && mouseDelta.length() > 0.01) {
      this.snappedAxis = this.determineSnapAxisFromScreenDelta(mouseDelta, camera);
    }

    // Calculate the offset along the snapped axis
    let offset = new THREE.Vector3(0, 0, 0);
    if (this.snappedAxis && mouseDelta.length() > 0.01) {
      // Project the mouse delta onto the snapped axis in screen space
      // and scale by a sensitivity factor
      const sensitivity = 10; // Adjust this to control movement speed
      const movementDistance = this.projectMouseDeltaOntoAxis(mouseDelta, this.snappedAxis, camera) * sensitivity;
      offset = this.snappedAxis.clone().multiplyScalar(movementDistance);
    }

    // Round to integer grid positions
    offset.x = Math.round(offset.x);
    offset.y = Math.round(offset.y);
    offset.z = Math.round(offset.z);

    return offset;
  }

  private projectMouseDeltaOntoAxis(
    mouseDelta: THREE.Vector2,
    worldAxis: THREE.Vector3,
    camera: THREE.Camera
  ): number {
    // Get camera axes
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.copy(camera.matrixWorld);

    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    
    cameraRight.setFromMatrixColumn(cameraMatrix, 0).normalize();
    cameraUp.setFromMatrixColumn(cameraMatrix, 1).normalize();

    // Project world axis onto screen space
    const axisInCameraRight = worldAxis.dot(cameraRight);
    const axisInCameraUp = worldAxis.dot(cameraUp);

    // Calculate dot product of mouse delta with axis projection in screen space
    const projection = mouseDelta.x * axisInCameraRight + mouseDelta.y * axisInCameraUp;

    return projection;
  }

  private determineSnapAxisFromScreenDelta(
    mouseDelta: THREE.Vector2,
    camera: THREE.Camera
  ): THREE.Vector3 {
    // Get the camera's view matrix
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.copy(camera.matrixWorld);

    // Extract camera axes
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    
    cameraRight.setFromMatrixColumn(cameraMatrix, 0).normalize();
    cameraUp.setFromMatrixColumn(cameraMatrix, 1).normalize();

    // World axes
    const worldX = new THREE.Vector3(1, 0, 0);
    const worldY = new THREE.Vector3(0, 1, 0);
    const worldZ = new THREE.Vector3(0, 0, 1);

    // Determine which direction in camera space the user is dragging more
    const isDraggingMoreHorizontally = Math.abs(mouseDelta.x) > Math.abs(mouseDelta.y);
    
    const axes = [worldX, worldY, worldZ];

    let bestAxis = worldX;
    let bestScore = -Infinity;

    for (const axis of axes) {
      // Project world axis onto camera axes
      const axisInCameraRight = axis.dot(cameraRight);
      const axisInCameraUp = axis.dot(cameraUp);
      
      // Calculate alignment with drag direction in camera space
      let score = 0;
      if (isDraggingMoreHorizontally) {
        // User is dragging horizontally, prefer axes aligned with camera right
        score = Math.abs(axisInCameraRight) * Math.sign(mouseDelta.x * axisInCameraRight);
      } else {
        // User is dragging vertically, prefer axes aligned with camera up
        score = Math.abs(axisInCameraUp) * Math.sign(mouseDelta.y * axisInCameraUp);
      }

      if (score > bestScore) {
        bestScore = score;
        bestAxis = axis.clone();
        
        // Determine the sign based on mouse delta direction
        const axisScreenDot = mouseDelta.x * axisInCameraRight + mouseDelta.y * axisInCameraUp;
        if (axisScreenDot < 0) {
          bestAxis.negate();
        }
      }
    }

    return bestAxis;
  }
}
