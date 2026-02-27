import * as THREE from "three";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { createBoundsBox, updateBoundsBox, disposeBoundsBox, type BoundsBox } from "./bounds-box-helper";

type HandleId =
  | "body"
  | "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

const HANDLE_COLOR = 0xffaa44;
const HANDLE_ACTIVE_COLOR = 0xffdd88;
const BOUNDS_COLOR = 0x44aaff;
const HANDLE_RADIUS = 0.35;
const HANDLE_HIT_RADIUS = 1.2;

export class ObjectTransformTool implements Tool {
  private boundsBoxHelper: BoundsBox | null = null;
  private handleMeshes: THREE.Mesh[] = [];
  private handleGroup: THREE.Group | null = null;

  private activeHandle: HandleId | null = null;
  private dragStartMouse: THREE.Vector2 | null = null;
  private dragStartPosition: Vector3 | null = null;
  private dragStartDimensions: Vector3 | null = null;
  private snappedAxis: THREE.Vector3 | null = null;
  private dragReferencePoint: THREE.Vector3 | null = null;
  private appliedOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  getType(): ToolType {
    return "ObjectTransform";
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
    this.renderHandles(context);
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    const obj = getActiveObject(context);
    if (!obj) return;

    this.activeHandle = this.hitTestHandles(event.mousePosition, context);
    if (!this.activeHandle) {
      this.activeHandle = "body";
    }

    this.dragStartMouse = event.mousePosition.clone();
    this.dragStartPosition = { ...obj.position };
    this.dragStartDimensions = { ...obj.dimensions };
    this.snappedAxis = null;
    this.appliedOffset.set(0, 0, 0);

    const pos = obj.position;
    const dim = obj.dimensions;
    this.dragReferencePoint = new THREE.Vector3(
      pos.x + dim.x / 2,
      pos.y + dim.y / 2,
      pos.z + dim.z / 2
    );
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    if (!this.activeHandle || !this.dragStartPosition || !this.dragStartDimensions) return;

    const obj = getActiveObject(context);
    if (!obj) return;

    if (this.activeHandle === "body") {
      this.handleBodyDrag(context, event, obj);
    } else {
      this.handleResizeDrag(context, event, obj);
    }

    this.renderHandles(context);
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    if (this.activeHandle && this.dragStartPosition && this.dragStartDimensions) {
      const obj = getActiveObject(context);
      if (obj) {
        if (this.activeHandle === "body") {
          this.handleBodyDrag(context, event, obj);
        } else {
          this.handleResizeDrag(context, event, obj);
        }
      }
    }

    this.activeHandle = null;
    this.dragStartMouse = null;
    this.dragStartPosition = null;
    this.dragStartDimensions = null;
    this.snappedAxis = null;
    this.appliedOffset.set(0, 0, 0);
    this.dragReferencePoint = null;
    this.renderHandles(context);
  }

  onMouseMove(context: ToolContext, mousePos: THREE.Vector2): void {
    const hit = this.hitTestHandles(mousePos, context);
    this.updateHandleHighlight(hit);
  }

  dispose(): void {
    if (this.boundsBoxHelper) {
      disposeBoundsBox(this.boundsBoxHelper);
      this.boundsBoxHelper = null;
    }
    if (this.handleGroup) {
      this.handleGroup.parent?.remove(this.handleGroup);
      for (const mesh of this.handleMeshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      this.handleMeshes = [];
      this.handleGroup = null;
    }
  }

  private handleBodyDrag(
    context: ToolContext,
    event: ToolDragEvent,
    obj: ReturnType<typeof getActiveObject>
  ): void {
    if (!obj || !this.dragStartPosition) return;

    const totalOffset = this.calculateOffsetFromMouseDelta(
      event.startMousePosition,
      event.currentMousePosition,
      context.camera
    );

    const incrementalOffset = new THREE.Vector3().subVectors(totalOffset, this.appliedOffset);

    if (incrementalOffset.lengthSq() > 0) {
      context.reducers.moveObject(context.projectId, obj.id, {
        x: incrementalOffset.x,
        y: incrementalOffset.y,
        z: incrementalOffset.z,
      });
      this.appliedOffset.copy(totalOffset);

      const pos = obj.position;
      const dim = obj.dimensions;
      this.dragReferencePoint = new THREE.Vector3(
        pos.x + dim.x / 2,
        pos.y + dim.y / 2,
        pos.z + dim.z / 2
      );
    }
  }

  private handleResizeDrag(
    context: ToolContext,
    event: ToolDragEvent,
    obj: ReturnType<typeof getActiveObject>
  ): void {
    if (!obj || !this.dragStartPosition || !this.dragStartDimensions || !this.activeHandle) return;

    const handle = this.activeHandle as Exclude<HandleId, "body">;
    const axisMap: Record<string, THREE.Vector3> = {
      "+x": new THREE.Vector3(1, 0, 0),
      "-x": new THREE.Vector3(-1, 0, 0),
      "+y": new THREE.Vector3(0, 1, 0),
      "-y": new THREE.Vector3(0, -1, 0),
      "+z": new THREE.Vector3(0, 0, 1),
      "-z": new THREE.Vector3(0, 0, -1),
    };

    const axis = axisMap[handle];
    if (!axis) return;

    const voxelCount = this.projectMouseDeltaOntoAxis(
      event.startMousePosition,
      event.currentMousePosition,
      axis,
      context.camera,
      obj
    );

    const startDims = this.dragStartDimensions;
    const startPos = this.dragStartPosition;

    let newDimX = startDims.x;
    let newDimY = startDims.y;
    let newDimZ = startDims.z;
    let newPosX = startPos.x;
    let newPosY = startPos.y;
    let newPosZ = startPos.z;

    if (handle === "+x") {
      newDimX = Math.max(1, startDims.x + voxelCount);
    } else if (handle === "-x") {
      const delta = Math.min(voxelCount, startDims.x - 1);
      newDimX = startDims.x - delta;
      newPosX = startPos.x + delta;
    } else if (handle === "+y") {
      newDimY = Math.max(1, startDims.y + voxelCount);
    } else if (handle === "-y") {
      const delta = Math.min(voxelCount, startDims.y - 1);
      newDimY = startDims.y - delta;
      newPosY = startPos.y + delta;
    } else if (handle === "+z") {
      newDimZ = Math.max(1, startDims.z + voxelCount);
    } else if (handle === "-z") {
      const delta = Math.min(voxelCount, startDims.z - 1);
      newDimZ = startDims.z - delta;
      newPosZ = startPos.z + delta;
    }

    context.reducers.resizeObject(
      context.projectId,
      obj.id,
      { x: newDimX, y: newDimY, z: newDimZ },
      { x: newPosX, y: newPosY, z: newPosZ }
    );
  }

  private projectMouseDeltaOntoAxis(
    startMouse: THREE.Vector2,
    currentMouse: THREE.Vector2,
    axis: THREE.Vector3,
    camera: THREE.Camera,
    obj: NonNullable<ReturnType<typeof getActiveObject>>
  ): number {
    const center = new THREE.Vector3(
      obj.position.x + obj.dimensions.x / 2,
      obj.position.y + obj.dimensions.y / 2,
      obj.position.z + obj.dimensions.z / 2
    );

    const p0 = center.clone().project(camera);
    const p1 = center.clone().add(axis).project(camera);

    const axisScreen = new THREE.Vector2(p1.x - p0.x, p1.y - p0.y);
    const axisScreenLenSq = axisScreen.dot(axisScreen);
    if (axisScreenLenSq < 1e-10) return 0;

    const mouseDelta = new THREE.Vector2().subVectors(currentMouse, startMouse);
    return Math.round(mouseDelta.dot(axisScreen) / axisScreenLenSq);
  }

  private hitTestHandles(mousePos: THREE.Vector2, context: ToolContext): HandleId | null {
    const obj = getActiveObject(context);
    if (!obj) return null;

    const pos = obj.position;
    const dim = obj.dimensions;

    const handles: { id: HandleId; worldPos: THREE.Vector3 }[] = [
      { id: "+x", worldPos: new THREE.Vector3(pos.x + dim.x, pos.y + dim.y / 2, pos.z + dim.z / 2) },
      { id: "-x", worldPos: new THREE.Vector3(pos.x,         pos.y + dim.y / 2, pos.z + dim.z / 2) },
      { id: "+y", worldPos: new THREE.Vector3(pos.x + dim.x / 2, pos.y + dim.y, pos.z + dim.z / 2) },
      { id: "-y", worldPos: new THREE.Vector3(pos.x + dim.x / 2, pos.y,         pos.z + dim.z / 2) },
      { id: "+z", worldPos: new THREE.Vector3(pos.x + dim.x / 2, pos.y + dim.y / 2, pos.z + dim.z) },
      { id: "-z", worldPos: new THREE.Vector3(pos.x + dim.x / 2, pos.y + dim.y / 2, pos.z) },
    ];

    let closest: HandleId | null = null;
    let closestDist = Infinity;

    for (const handle of handles) {
      const screenPos = handle.worldPos.clone().project(context.camera);
      const dx = screenPos.x - mousePos.x;
      const dy = screenPos.y - mousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const normalizedHitRadius = HANDLE_HIT_RADIUS * 0.05;

      if (dist < normalizedHitRadius && dist < closestDist) {
        closestDist = dist;
        closest = handle.id;
      }
    }

    return closest;
  }

  private updateHandleHighlight(hoveredHandle: HandleId | null): void {
    const handleIds: HandleId[] = ["+x", "-x", "+y", "-y", "+z", "-z"];
    for (let i = 0; i < this.handleMeshes.length && i < handleIds.length; i++) {
      const mat = this.handleMeshes[i].material as THREE.MeshBasicMaterial;
      mat.color.setHex(handleIds[i] === hoveredHandle ? HANDLE_ACTIVE_COLOR : HANDLE_COLOR);
    }
  }

  private renderHandles(context: ToolContext): void {
    const obj = getActiveObject(context);
    if (!obj) {
      this.dispose();
      return;
    }

    const pos = obj.position;
    const dim = obj.dimensions;

    if (!this.boundsBoxHelper) {
      this.boundsBoxHelper = createBoundsBox(BOUNDS_COLOR);
      context.scene.add(this.boundsBoxHelper.group);
    }

    updateBoundsBox(
      this.boundsBoxHelper,
      pos.x, pos.y, pos.z,
      pos.x + dim.x, pos.y + dim.y, pos.z + dim.z
    );

    if (!this.handleGroup) {
      this.handleGroup = new THREE.Group();
      this.handleGroup.renderOrder = 1000;
      context.scene.add(this.handleGroup);
      this.createHandleMeshes();
    }

    this.positionHandles(pos, dim);
  }

  private createHandleMeshes(): void {
    const geometry = new THREE.SphereGeometry(HANDLE_RADIUS, 8, 8);
    for (let i = 0; i < 6; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: HANDLE_COLOR,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 1000;
      this.handleMeshes.push(mesh);
      this.handleGroup!.add(mesh);
    }
  }

  private positionHandles(pos: Vector3, dim: Vector3): void {
    const cx = pos.x + dim.x / 2;
    const cy = pos.y + dim.y / 2;
    const cz = pos.z + dim.z / 2;

    // +x, -x, +y, -y, +z, -z
    this.handleMeshes[0]?.position.set(pos.x + dim.x, cy, cz);
    this.handleMeshes[1]?.position.set(pos.x, cy, cz);
    this.handleMeshes[2]?.position.set(cx, pos.y + dim.y, cz);
    this.handleMeshes[3]?.position.set(cx, pos.y, cz);
    this.handleMeshes[4]?.position.set(cx, cy, pos.z + dim.z);
    this.handleMeshes[5]?.position.set(cx, cy, pos.z);
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
