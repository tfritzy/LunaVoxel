import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class MoveSelectionTool implements Tool {
  private dragStartPos: THREE.Vector3 | null = null;
  private snappedAxis: THREE.Vector3 | null = null;

  getType(): ToolType {
    return "MoveSelection";
  }

  calculateGridPosition(
    intersectionPoint: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3 {
    return calculateGridPositionWithMode(intersectionPoint, normal, "under");
  }

  onMouseDown(_context: ToolContext, position: THREE.Vector3): void {
    this.dragStartPos = position.clone();
    this.snappedAxis = null;
  }

  onDrag(
    context: ToolContext,
    startPos: THREE.Vector3,
    currentPos: THREE.Vector3
  ): void {
    // Calculate the drag delta in world space
    const dragDelta = new THREE.Vector3().subVectors(currentPos, startPos);

    // If we haven't determined the axis yet, do so based on the initial drag direction
    if (!this.snappedAxis && dragDelta.length() > 0.1) {
      this.snappedAxis = this.determineSnapAxis(dragDelta, context.camera);
    }

    // If we have a snapped axis, project the drag delta onto it
    if (this.snappedAxis) {
      const projectedDistance = dragDelta.dot(this.snappedAxis);
      const offset = this.snappedAxis.clone().multiplyScalar(projectedDistance);
      
      // Round to integer grid positions
      offset.x = Math.round(offset.x);
      offset.y = Math.round(offset.y);
      offset.z = Math.round(offset.z);

      // Preview could be shown here if needed
      // For now, we'll just wait until mouse up to apply the move
    }
  }

  onMouseUp(
    context: ToolContext,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3
  ): void {
    // Calculate the drag delta in world space
    const dragDelta = new THREE.Vector3().subVectors(endPos, startPos);

    // Determine the snap axis if not already determined
    if (!this.snappedAxis && dragDelta.length() > 0.1) {
      this.snappedAxis = this.determineSnapAxis(dragDelta, context.camera);
    }

    // Calculate the offset along the snapped axis
    let offset = new THREE.Vector3(0, 0, 0);
    if (this.snappedAxis) {
      const projectedDistance = dragDelta.dot(this.snappedAxis);
      offset = this.snappedAxis.clone().multiplyScalar(projectedDistance);
    }

    // Round to integer grid positions
    offset.x = Math.round(offset.x);
    offset.y = Math.round(offset.y);
    offset.z = Math.round(offset.z);

    // Only call the reducer if there's actual movement
    if (offset.length() > 0.1) {
      context.dbConn.reducers.moveSelection(
        context.projectId,
        offset
      );
    }

    // Reset state
    this.dragStartPos = null;
    this.snappedAxis = null;
  }

  private determineSnapAxis(dragDelta: THREE.Vector3, camera: THREE.Camera): THREE.Vector3 {
    // Get the camera's view matrix to determine which axes are most aligned with screen space
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.copy(camera.matrixWorld);

    // Extract camera axes
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();
    
    cameraRight.setFromMatrixColumn(cameraMatrix, 0).normalize();
    cameraUp.setFromMatrixColumn(cameraMatrix, 1).normalize();
    cameraForward.setFromMatrixColumn(cameraMatrix, 2).normalize().negate(); // Forward is -Z in camera space

    // World axes
    const worldX = new THREE.Vector3(1, 0, 0);
    const worldY = new THREE.Vector3(0, 1, 0);
    const worldZ = new THREE.Vector3(0, 0, 1);

    // Project drag delta onto camera space to determine screen-space direction
    const dragInCameraRight = dragDelta.dot(cameraRight);
    const dragInCameraUp = dragDelta.dot(cameraUp);

    // Determine which direction in camera space the user is dragging more
    const isDraggingMoreHorizontally = Math.abs(dragInCameraRight) > Math.abs(dragInCameraUp);
    
    // For each world axis, determine how aligned it is with the drag direction
    // considering the camera's current orientation
    const axes = [
      { axis: worldX, name: "X" },
      { axis: worldY, name: "Y" },
      { axis: worldZ, name: "Z" }
    ];

    let bestAxis = worldX;
    let bestScore = -Infinity;

    for (const { axis } of axes) {
      // Project world axis onto camera axes
      const axisInCameraRight = axis.dot(cameraRight);
      const axisInCameraUp = axis.dot(cameraUp);
      
      // Calculate alignment with drag direction in camera space
      let score = 0;
      if (isDraggingMoreHorizontally) {
        // User is dragging horizontally, prefer axes aligned with camera right
        score = Math.abs(axisInCameraRight) * Math.sign(dragInCameraRight * axisInCameraRight);
      } else {
        // User is dragging vertically, prefer axes aligned with camera up
        score = Math.abs(axisInCameraUp) * Math.sign(dragInCameraUp * axisInCameraUp);
      }

      // Also consider how much the axis aligns with the actual 3D drag vector
      const dragAlignment = Math.abs(dragDelta.clone().normalize().dot(axis));
      score += dragAlignment * 0.5; // Weight the 3D alignment slightly less

      if (score > bestScore) {
        bestScore = score;
        bestAxis = axis.clone();
        
        // Determine the sign based on which direction gives better alignment
        if (dragDelta.dot(axis) < 0) {
          bestAxis.negate();
        }
      }
    }

    return bestAxis;
  }
}
