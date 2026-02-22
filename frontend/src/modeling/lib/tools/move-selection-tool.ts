import * as THREE from "three";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";

export class MoveSelectionTool implements Tool {
  private snappedAxis: THREE.Vector3 | null = null;
  private appliedOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private cachedBounds: { min: Vector3; max: Vector3 } | null = null;
  private boundsBoxHelper: THREE.Box3Helper | null = null;
  private dragReferencePoint: THREE.Vector3 | null = null;
  private movingObject: boolean = false;

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

  onActivate(context: ToolContext): void {
    this.cachedBounds = this.computeBounds(context);
    this.renderBoundsBox(context, this.cachedBounds);
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    void event;
    this.snappedAxis = null;
    this.appliedOffset.set(0, 0, 0);

    const object = getActiveObject(context);
    this.movingObject = !!(object && !context.stateStore.getState().voxelSelection);

    this.cachedBounds = this.computeBounds(context);

    if (this.cachedBounds) {
      this.dragReferencePoint = new THREE.Vector3(
        (this.cachedBounds.min.x + this.cachedBounds.max.x) / 2,
        (this.cachedBounds.min.y + this.cachedBounds.max.y) / 2,
        (this.cachedBounds.min.z + this.cachedBounds.max.z) / 2
      );
    }

    if (!this.movingObject) {
      context.reducers.beginSelectionMove(context.projectId);
    }
    this.renderBoundsBox(context, this.cachedBounds);
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    const totalOffset = this.calculateOffsetFromMouseDelta(
      event.startMousePosition,
      event.currentMousePosition,
      context.camera
    );

    const incrementalOffset = new THREE.Vector3().subVectors(totalOffset, this.appliedOffset);

    if (incrementalOffset.lengthSq() > 0) {
      if (this.movingObject) {
        const obj = getActiveObject(context);
        if (obj) {
          context.reducers.moveObject(context.projectId, obj.index, {
            x: incrementalOffset.x,
            y: incrementalOffset.y,
            z: incrementalOffset.z,
          });
        }
      } else {
        context.reducers.moveSelection(context.projectId, {
          x: incrementalOffset.x,
          y: incrementalOffset.y,
          z: incrementalOffset.z,
        });
      }
      this.appliedOffset.copy(totalOffset);
      this.cachedBounds = this.computeBounds(context);
      if (this.cachedBounds) {
        this.dragReferencePoint = new THREE.Vector3(
          (this.cachedBounds.min.x + this.cachedBounds.max.x) / 2,
          (this.cachedBounds.min.y + this.cachedBounds.max.y) / 2,
          (this.cachedBounds.min.z + this.cachedBounds.max.z) / 2
        );
      }
    }

    this.renderBoundsBox(context, this.cachedBounds);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    const totalOffset = this.calculateOffsetFromMouseDelta(
      event.startMousePosition,
      event.currentMousePosition,
      context.camera
    );

    const incrementalOffset = new THREE.Vector3().subVectors(totalOffset, this.appliedOffset);

    if (incrementalOffset.lengthSq() > 0) {
      if (this.movingObject) {
        const obj = getActiveObject(context);
        if (obj) {
          context.reducers.moveObject(context.projectId, obj.index, {
            x: incrementalOffset.x,
            y: incrementalOffset.y,
            z: incrementalOffset.z,
          });
        }
      } else {
        context.reducers.moveSelection(context.projectId, {
          x: incrementalOffset.x,
          y: incrementalOffset.y,
          z: incrementalOffset.z,
        });
      }
    }

    if (!this.movingObject) {
      context.reducers.commitSelectionMove(context.projectId);
    }

    this.snappedAxis = null;
    this.appliedOffset.set(0, 0, 0);
    this.dragReferencePoint = null;
    this.movingObject = false;
    this.cachedBounds = this.computeBounds(context);
    this.renderBoundsBox(context, this.cachedBounds);
  }

  dispose(): void {
    if (this.boundsBoxHelper) {
      this.boundsBoxHelper.parent?.remove(this.boundsBoxHelper);
      this.boundsBoxHelper.geometry.dispose();
      (this.boundsBoxHelper.material as THREE.Material).dispose();
      this.boundsBoxHelper = null;
    }
  }

  private computeBounds(context: ToolContext): { min: Vector3; max: Vector3 } | null {
    const object = getActiveObject(context);
    if (!object) return null;

    const voxelSelection = context.stateStore.getState().voxelSelection;
    if (voxelSelection && voxelSelection.objectId === object.id) {
      return {
        min: voxelSelection.frame.getMinPos(),
        max: voxelSelection.frame.getMaxPos(),
      };
    }

    return context.projectManager.chunkManager.getObjectContentBounds(object.index);
  }

  private renderBoundsBox(
    context: ToolContext,
    bounds: { min: Vector3; max: Vector3 } | null
  ): void {
    if (!bounds) {
      this.dispose();
      return;
    }

    if (!this.boundsBoxHelper) {
      this.boundsBoxHelper = new THREE.Box3Helper(
        new THREE.Box3(),
        0x44ff88
      );
      context.scene.add(this.boundsBoxHelper);
    }

    this.boundsBoxHelper.box.min.set(bounds.min.x, bounds.min.y, bounds.min.z);
    this.boundsBoxHelper.box.max.set(bounds.max.x, bounds.max.y, bounds.max.z);
    this.boundsBoxHelper.updateMatrixWorld(true);
  }

  private calculateOffsetFromMouseDelta(
    startMousePos: THREE.Vector2,
    currentMousePos: THREE.Vector2,
    camera: THREE.Camera
  ): THREE.Vector3 {
    const mouseDelta = new THREE.Vector2().subVectors(currentMousePos, startMousePos);

    if (!this.snappedAxis && mouseDelta.length() > 0.01) {
      this.snappedAxis = this.determineSnapAxisFromScreenDelta(mouseDelta, camera);
    }

    if (!this.snappedAxis || !this.dragReferencePoint) return new THREE.Vector3(0, 0, 0);

    const p0 = this.dragReferencePoint.clone().project(camera);
    const p1 = this.dragReferencePoint.clone().add(this.snappedAxis).project(camera);

    const axisScreenDelta = new THREE.Vector2(p1.x - p0.x, p1.y - p0.y);
    const axisScreenLenSq = axisScreenDelta.dot(axisScreenDelta);
    if (axisScreenLenSq < 1e-10) return new THREE.Vector3(0, 0, 0);

    const voxelCount = Math.round(mouseDelta.dot(axisScreenDelta) / axisScreenLenSq);
    return this.snappedAxis.clone().multiplyScalar(voxelCount);
  }

  private determineSnapAxisFromScreenDelta(
    mouseDelta: THREE.Vector2,
    camera: THREE.Camera
  ): THREE.Vector3 {
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.copy(camera.matrixWorld);

    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    
    cameraRight.setFromMatrixColumn(cameraMatrix, 0).normalize();
    cameraUp.setFromMatrixColumn(cameraMatrix, 1).normalize();

    const worldX = new THREE.Vector3(1, 0, 0);
    const worldY = new THREE.Vector3(0, 1, 0);
    const worldZ = new THREE.Vector3(0, 0, 1);

    const isDraggingMoreHorizontally = Math.abs(mouseDelta.x) > Math.abs(mouseDelta.y);
    
    const axes = [worldX, worldY, worldZ];

    let bestAxis = worldX;
    let bestScore = -Infinity;

    for (const axis of axes) {
      const axisInCameraRight = axis.dot(cameraRight);
      const axisInCameraUp = axis.dot(cameraUp);
      
      let score = 0;
      if (isDraggingMoreHorizontally) {
        score = Math.abs(axisInCameraRight) * Math.sign(mouseDelta.x * axisInCameraRight);
      } else {
        score = Math.abs(axisInCameraUp) * Math.sign(mouseDelta.y * axisInCameraUp);
      }

      if (score > bestScore) {
        bestScore = score;
        bestAxis = axis.clone();
        
        const axisScreenDot = mouseDelta.x * axisInCameraRight + mouseDelta.y * axisInCameraUp;
        if (axisScreenDot < 0) {
          bestAxis.negate();
        }
      }
    }

    return bestAxis;
  }
}
