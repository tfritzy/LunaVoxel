import * as THREE from "three";
import { layers } from "./layers";
import { BlockModificationMode } from "@/module_bindings";

export type Tool = "build" | "erase" | "paint";

export interface GridRaycasterEvents {
  onHover?: (gridPos: THREE.Vector3 | null, pos: THREE.Vector3 | null) => void;
  onClick?: (position: THREE.Vector3 | null) => void;
}

export class GridRaycaster {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private domElement: HTMLElement;
  private events: GridRaycasterEvents;
  private currentTool: BlockModificationMode = { tag: "Build" };
  private boundMouseMove: (event: MouseEvent) => void;
  private boundMouseClick: (event: MouseEvent) => void;
  private lastHoveredPosition: THREE.Vector3 | null = null;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    domElement: HTMLElement,
    events: GridRaycasterEvents = {}
  ) {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(layers.raycast);
    this.mouse = new THREE.Vector2();
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;
    this.events = events;
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseClick = this.onMouseClick.bind(this);
    this.addEventListeners();
  }

  public setTool(tool: BlockModificationMode): void {
    this.currentTool = tool;
  }

  private addEventListeners(): void {
    this.domElement.addEventListener("mousemove", this.boundMouseMove);
    this.domElement.addEventListener("mouseup", this.boundMouseClick);
  }

  private removeEventListeners(): void {
    this.domElement.removeEventListener("mousemove", this.boundMouseMove);
    this.domElement.removeEventListener("mouseup", this.boundMouseClick);
  }

  private onMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);
    const { gridPos, pos } = this.checkIntersection();

    this.lastHoveredPosition = gridPos || this.lastHoveredPosition;

    if (this.events.onHover) {
      this.events.onHover(gridPos, pos);
    }
  }

  private onMouseClick(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.updateMousePosition(event);
    const { gridPos } = this.checkIntersection();

    if (this.events.onClick) {
      this.events.onClick(gridPos || this.lastHoveredPosition);
    }
  }

  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private checkIntersection(): {
    gridPos: THREE.Vector3 | null;
    pos: THREE.Vector3 | null;
  } {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    if (intersects.length > 0) {
      const intersection = intersects[0];

      const point = this.floorVector3(intersection.point);

      if (intersection.object.userData.isBoundaryBox) {
        return { gridPos: point, pos: intersection.point };
      } else {
        if (
          this.currentTool.tag === "Erase" ||
          this.currentTool.tag === "Paint"
        ) {
          const normal = intersection.face?.normal.multiplyScalar(-0.1);
          if (normal) {
            return {
              gridPos: this.floorVector3(point.add(normal)),
              pos: intersection.point,
            };
          }
          return { gridPos: point, pos: intersection.point };
        } else {
          const normal = intersection.face?.normal.multiplyScalar(0.1);
          if (normal) {
            return {
              gridPos: this.floorVector3(point.add(normal)),
              pos: intersection.point,
            };
          }
          return { gridPos: point, pos: intersection.point };
        }
      }
    }

    return { gridPos: null, pos: null };
  }

  private floorVector3(vector3: THREE.Vector3) {
    vector3.x = Math.floor(vector3.x);
    vector3.y = Math.floor(vector3.y);
    vector3.z = Math.floor(vector3.z);
    return vector3;
  }

  public updateCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  public dispose(): void {
    this.removeEventListeners();
  }
}
