import * as THREE from "three";

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private panSpeed: number = 0.02;
  private zoomSpeed: number = 2;
  private keys: { [key: string]: boolean } = {};
  private keysProcessed: { [key: string]: boolean } = {};
  private panMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private rotationAngle: number = 0;
  private distance: number = 0;

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
    this.distance = this.getDistanceToTarget();

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
    this.keys[event.key.toLowerCase()] = true;
  }

  private onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keys[key] = false;
    this.keysProcessed[key] = false;
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 2) {
      this.panMouseDown = true;
      this.domElement.style.cursor = "grabbing";
    }

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2) {
      this.panMouseDown = false;
      this.domElement.style.cursor = "auto";
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    if (this.panMouseDown) {
      this.panCamera(-deltaX * this.panSpeed, -deltaY * this.panSpeed);
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

    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.target)
      .normalize();

    this.distance = Math.max(1, this.distance + zoomAmount);

    this.camera.position.copy(
      direction.multiplyScalar(this.distance).add(this.target)
    );
  }

  private rotateCamera(angleRadians: number): void {
    this.rotationAngle += angleRadians;
    const currentHeight = this.camera.position.y;
    const deltaX = this.camera.position.x - this.target.x;
    const deltaZ = this.camera.position.z - this.target.z;
    const horizontalDistance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

    const newX =
      this.target.x + horizontalDistance * Math.sin(this.rotationAngle);
    const newZ =
      this.target.z + horizontalDistance * Math.cos(this.rotationAngle);
    this.camera.position.set(newX, currentHeight, newZ);
    this.camera.lookAt(this.target);
  }

  update(): void {
    let hasUpdated = false;

    if (this.keys["q"] && !this.keysProcessed["q"]) {
      this.rotateCamera(-Math.PI / 4);
      this.keysProcessed["q"] = true;
      hasUpdated = true;
    }
    if (this.keys["e"] && !this.keysProcessed["e"]) {
      this.rotateCamera(Math.PI / 4);
      this.keysProcessed["e"] = true;
      hasUpdated = true;
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
