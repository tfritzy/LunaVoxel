import * as THREE from "three";
import { GridPosition } from "../../types";

export interface GridRaycasterEvents {
  onHover?: (position: GridPosition | null) => void;
  onClick?: (position: GridPosition | null) => void;
}

export class GridRaycaster {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera;
  private groundPlane: THREE.Object3D;
  private domElement: HTMLElement;
  private events: GridRaycasterEvents;
  private boundMouseMove: (event: MouseEvent) => void;
  private boundMouseClick: (event: MouseEvent) => void;

  constructor(
    camera: THREE.Camera,
    groundPlane: THREE.Object3D,
    domElement: HTMLElement,
    events: GridRaycasterEvents = {}
  ) {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.camera = camera;
    this.groundPlane = groundPlane;
    this.domElement = domElement;
    this.events = events;

    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseClick = this.onMouseClick.bind(this);

    this.addEventListeners();
  }

  private addEventListeners(): void {
    this.domElement.addEventListener("mousemove", this.boundMouseMove);
    this.domElement.addEventListener("click", this.boundMouseClick);
  }

  private removeEventListeners(): void {
    this.domElement.removeEventListener("mousemove", this.boundMouseMove);
    this.domElement.removeEventListener("click", this.boundMouseClick);
  }

  private onMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);
    const gridPosition = this.checkIntersection();

    if (this.events.onHover) {
      this.events.onHover(gridPosition);
    }
  }

  private onMouseClick(event: MouseEvent): void {
    this.updateMousePosition(event);
    const gridPosition = this.checkIntersection();

    if (this.events.onClick) {
      this.events.onClick(gridPosition);
    }
  }

  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private checkIntersection(): GridPosition | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.groundPlane, true);

    if (intersects.length > 0) {
      const point = intersects[0].point;

      const gridX = Math.floor(point.x + 0.5);
      const gridZ = Math.floor(point.z + 0.5);

      return { x: gridX, z: gridZ };
    }

    return null;
  }

  public updateCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  public updateGroundPlane(groundPlane: THREE.Object3D): void {
    this.groundPlane = groundPlane;
  }

  public raycastAtMouse(): GridPosition | null {
    return this.checkIntersection();
  }

  public dispose(): void {
    this.removeEventListeners();
  }
}
