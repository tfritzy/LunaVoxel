import * as THREE from "three";

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  distance: number;
  phi: number;
  theta: number;
  currentRotationAngle: number;
  targetRotationAngle: number;
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private panSpeed: number = 0.02;
  private zoomSpeed: number = 2;
  private rotationSpeed: number = 0.003;

  private zoomScaleMultiplier: number = 0.01;
  private minZoomSpeed: number = 0.1;
  private maxZoomSpeed: number = 10;

  private rotateMouseDown: boolean = false;
  private panMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private currentRotationAngle: number = 0;
  private targetRotationAngle: number = 0;
  private isRotating: boolean = false;
  private distance: number = 0;

  private phi: number = Math.PI / 4;
  private theta: number = Math.PI / 4;
  private isDragging: boolean = false;
  private isPanning: boolean = false;

  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseUp: (event: MouseEvent) => void;
  private boundMouseMove: (event: MouseEvent) => void;
  private boundWheel: (event: WheelEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    targetPos: THREE.Vector3,
    domElement: HTMLElement
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = targetPos;

    this.distance = this.getDistanceToTarget();

    const deltaX = this.camera.position.x - this.target.x;
    const deltaZ = this.camera.position.z - this.target.z;
    this.currentRotationAngle = Math.atan2(deltaX, deltaZ);
    this.targetRotationAngle = this.currentRotationAngle;

    this.theta = this.currentRotationAngle;

    const horizontalDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    const deltaY = this.camera.position.y - this.target.y;
    this.phi = Math.atan2(horizontalDistance, deltaY);

    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);

    this.addEventListeners();
  }

  getCameraState(): CameraState {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      target: {
        x: this.target.x,
        y: this.target.y,
        z: this.target.z,
      },
      distance: this.distance,
      phi: this.phi,
      theta: this.theta,
      currentRotationAngle: this.currentRotationAngle,
      targetRotationAngle: this.targetRotationAngle,
    };
  }

  setCameraState(state: CameraState): void {
    this.camera.position.set(
      state.position.x,
      state.position.y,
      state.position.z
    );
    this.target.set(state.target.x, state.target.y, state.target.z);
    this.distance = state.distance;
    this.phi = state.phi;
    this.theta = state.theta;
    this.currentRotationAngle = state.currentRotationAngle;
    this.targetRotationAngle = state.targetRotationAngle;

    this.camera.lookAt(this.target);
  }

  private addEventListeners(): void {
    this.domElement.addEventListener("mousedown", this.boundMouseDown);
    this.domElement.addEventListener("mouseup", this.boundMouseUp);
    window.addEventListener("mouseup", this.boundMouseUp);
    window.addEventListener("mousemove", this.boundMouseMove);
    this.domElement.addEventListener("wheel", this.boundWheel);
    this.domElement.addEventListener("contextmenu", this.boundContextMenu);
  }

  private removeEventListeners(): void {
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    this.domElement.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("mousemove", this.boundMouseMove);
    this.domElement.removeEventListener("wheel", this.boundWheel);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);
  }

  private onMouseDown(event: MouseEvent): void {
    if (
      (event.button === 0 && event.shiftKey) ||
      (event.button === 2 && event.ctrlKey)
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.panMouseDown = true;
      this.isPanning = false;
    } else if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      this.rotateMouseDown = true;
      this.isDragging = false;
    }

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2 || (event.button === 0 && this.panMouseDown)) {
      event.preventDefault();
      event.stopPropagation();

      this.rotateMouseDown = false;
      this.panMouseDown = false;
      this.isDragging = false;
      this.isPanning = false;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (this.panMouseDown) {
      if (!this.isPanning && moveDistance > 3) {
        this.isPanning = true;
      }

      if (this.isPanning) {
        this.panCamera(deltaX, deltaY);
      }
    } else if (this.rotateMouseDown) {
      if (!this.isDragging && moveDistance > 3) {
        this.isDragging = true;
      }

      if (this.isDragging) {
        this.orbitCamera(deltaX, deltaY);
      }
    }

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();

    const delta = event.deltaY > 0 ? 1 : -1;
    this.zoomCamera(delta);
  }

  private onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private getDistanceToTarget(): number {
    return this.camera.position.distanceTo(this.target);
  }

  private orbitCamera(deltaX: number, deltaY: number): void {
    this.theta -= deltaX * this.rotationSpeed;

    this.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, this.phi - deltaY * this.rotationSpeed)
    );

    this.updateCameraPosition();
  }

  private panCamera(deltaX: number, deltaY: number): void {
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.copy(this.camera.matrixWorld);

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    right.setFromMatrixColumn(cameraMatrix, 0);
    up.setFromMatrixColumn(cameraMatrix, 1);

    right.normalize();
    up.normalize();

    const distanceScale = this.distance * 0.05;
    const scaledPanSpeed = this.panSpeed * distanceScale;

    const panX = -deltaX * scaledPanSpeed;
    const panY = deltaY * scaledPanSpeed;

    const moveX = right.clone().multiplyScalar(panX);
    const moveY = up.clone().multiplyScalar(panY);

    this.target.add(moveX).add(moveY);
    this.camera.position.add(moveX).add(moveY);
  }

  private zoomCamera(delta: number): void {
    const distanceBasedSpeed = this.distance * this.zoomScaleMultiplier;
    const adaptiveZoomSpeed = Math.max(
      this.minZoomSpeed,
      Math.min(this.maxZoomSpeed, this.zoomSpeed + distanceBasedSpeed)
    );

    const zoomAmount = delta * adaptiveZoomSpeed;

    this.distance = Math.max(1, this.distance + zoomAmount);

    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const x = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.distance * Math.cos(this.phi);
    const z = this.distance * Math.sin(this.phi) * Math.cos(this.theta);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );

    this.camera.lookAt(this.target);

    this.currentRotationAngle = this.theta;
  }

  update(deltaTime: number = 1 / 60): void {
    let hasUpdated = false;

    if (this.isRotating) {
      const angleDiff = this.targetRotationAngle - this.currentRotationAngle;

      let normalizedDiff = angleDiff;
      while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
      while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

      const step =
        Math.sign(normalizedDiff) *
        Math.min(
          Math.abs(normalizedDiff),
          this.rotationSpeed * deltaTime * 140
        );

      if (Math.abs(step) > 0.001) {
        this.currentRotationAngle += step;
        this.theta = this.currentRotationAngle;
        this.updateCameraPosition();
        hasUpdated = true;
      } else {
        this.currentRotationAngle = this.targetRotationAngle;
        this.theta = this.currentRotationAngle;
        this.updateCameraPosition();
        this.isRotating = false;
      }
    }

    if (hasUpdated) {
      this.camera.lookAt(this.target);
    }
  }

  getTarget(): THREE.Vector3 {
    return this.target.clone();
  }

  setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
    this.camera.lookAt(this.target);
  }

  dispose(): void {
    this.removeEventListeners();
  }
}
