import * as THREE from "three";
import type { ToolType } from "../tool-type";
import type { Tool, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import type { BlockModificationMode } from "@/state";

export class MoveSelectionTool implements Tool {
  private snappedAxis: THREE.Vector3 | null = null;
  private lastOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

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

  onMouseDown(_context: ToolContext, _event: ToolMouseEvent): void {
    this.snappedAxis = null;
    this.lastOffset = new THREE.Vector3(0, 0, 0);
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    const offset = this.calculateOffsetFromMouseDelta(
      event.startMousePosition,
      event.currentMousePosition,
      context.camera
    );

    this.lastOffset.copy(offset);
  }

  onMouseUp(context: ToolContext, _event: ToolDragEvent): void {
    if (this.lastOffset.length() > 0.1) {
      context.reducers.commitSelectionMove(
        {
          x: Math.round(this.lastOffset.x),
          y: Math.round(this.lastOffset.y),
          z: Math.round(this.lastOffset.z),
        }
      );
    }

    this.snappedAxis = null;
    this.lastOffset = new THREE.Vector3(0, 0, 0);
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
