import * as THREE from "three";

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private panSpeed: number = 0.02;
  private zoomSpeed: number = 2;
  private rotationSpeed: number = 0.003; // Reduced for smoother rotation
  private keys: { [key: string]: boolean } = {};
  // Changed from panMouseDown to rotateMouseDown for right-click
  private rotateMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private currentRotationAngle: number = 0;
  private targetRotationAngle: number = 0;
  private isRotating: boolean = false;
  private distance: number = 0;
  // Variables to track orbital rotation state
  private phi: number = Math.PI / 4; // vertical angle (start at 45 degrees)
  private theta: number = Math.PI / 4; // horizontal angle (start at 45 degrees)
  private isDragging: boolean = false; // Track if we're actually dragging vs just clicking

  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundKeyUp: (event: KeyboardEvent) => void;
  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseUp: (event: MouseEvent) => void;
  private boundMouseMove: (event: MouseEvent) => void;
  private boundWheel: (event: WheelEvent) => void;
  private boundContextMenu: (event: MouseEvent) => void;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Initialize the distance based on the current camera position
    this.distance = this.getDistanceToTarget();

    // Calculate initial rotation angles based on camera position
    const deltaX = this.camera.position.x - this.target.x;
    const deltaZ = this.camera.position.z - this.target.z;
    this.currentRotationAngle = Math.atan2(deltaX, deltaZ);
    this.targetRotationAngle = this.currentRotationAngle;

    // Set initial theta (horizontal) based on current camera position
    this.theta = this.currentRotationAngle;

    // Calculate initial phi (vertical angle) based on camera Y position
    const horizontalDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    const deltaY = this.camera.position.y - this.target.y;
    this.phi = Math.atan2(horizontalDistance, deltaY);

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);

    this.addEventListeners();
  }

  private addEventListeners(): void {
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    this.domElement.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mouseup", this.boundMouseUp);
    window.addEventListener("mousemove", this.boundMouseMove);
    this.domElement.addEventListener("wheel", this.boundWheel);
    this.domElement.addEventListener("contextmenu", this.boundContextMenu);
  }

  private removeEventListeners(): void {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.domElement.removeEventListener("mousedown", this.boundMouseDown);
    window.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("mousemove", this.boundMouseMove);
    this.domElement.removeEventListener("wheel", this.boundWheel);
    this.domElement.removeEventListener("contextmenu", this.boundContextMenu);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (!this.keys[key]) {
      this.keys[key] = true;

      if (key === "q") {
        this.targetRotationAngle = this.currentRotationAngle - Math.PI / 4;
        this.isRotating = true;
      } else if (key === "e") {
        this.targetRotationAngle = this.currentRotationAngle + Math.PI / 4;
        this.isRotating = true;
      }
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys[event.key.toLowerCase()] = false;
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 2) {
      // Right click
      // Changed from panMouseDown to rotateMouseDown
      this.rotateMouseDown = true;
      this.isDragging = false; // Reset drag state
      this.domElement.style.cursor = "grabbing";
    }

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2) {
      // Changed from panMouseDown to rotateMouseDown
      this.rotateMouseDown = false;
      this.isDragging = false;
      this.domElement.style.cursor = "auto";
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    // Only process movement if it's significant (prevents camera jump on initial click)
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (this.rotateMouseDown) {
      // Set dragging to true once movement is detected to prevent jumps
      if (!this.isDragging && moveDistance > 3) {
        this.isDragging = true;
      }

      if (this.isDragging) {
        // Only orbit camera if we're actually dragging
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

  // New method to orbit the camera around the target
  private orbitCamera(deltaX: number, deltaY: number): void {
    // Update theta (horizontal rotation) based on mouse X movement
    this.theta -= deltaX * this.rotationSpeed;

    // Update phi (vertical rotation) based on mouse Y movement
    // Clamp phi to avoid flipping the camera
    this.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, this.phi - deltaY * this.rotationSpeed)
    );

    // Update camera position based on spherical coordinates
    this.updateCameraPosition();
  }

  // We keep the panCamera method for WASD movement
  private panCamera(deltaX: number, deltaY: number): void {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const moveX = right.clone().multiplyScalar(deltaX);
    const moveZ = forward.clone().multiplyScalar(deltaY);

    this.target.add(moveX).add(moveZ);
    this.camera.position.add(moveX).add(moveZ);
  }

  private zoomCamera(delta: number): void {
    const zoomAmount = delta * this.zoomSpeed;

    this.distance = Math.max(1, this.distance + zoomAmount);

    // Update camera position after changing distance
    this.updateCameraPosition();
  }

  // Updated to use spherical coordinates instead of just horizontal rotation
  private updateCameraPosition(): void {
    // Convert spherical coordinates to Cartesian
    // Note the axis arrangement to match THREE.js coordinate system
    const x = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    const y = this.distance * Math.cos(this.phi);
    const z = this.distance * Math.sin(this.phi) * Math.cos(this.theta);

    // Set camera position relative to target
    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );

    // Make camera look at target
    this.camera.lookAt(this.target);

    // Update current rotation angle for Q/E keys
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

    const movementSpeed = this.panSpeed * 5;

    if (this.keys["w"] || this.keys["arrowup"]) {
      this.panCamera(0, -movementSpeed);
      hasUpdated = true;
    }
    if (this.keys["s"] || this.keys["arrowdown"]) {
      this.panCamera(0, movementSpeed);
      hasUpdated = true;
    }
    if (this.keys["a"] || this.keys["arrowleft"]) {
      this.panCamera(-movementSpeed, 0);
      hasUpdated = true;
    }
    if (this.keys["d"] || this.keys["arrowright"]) {
      this.panCamera(movementSpeed, 0);
      hasUpdated = true;
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
