import * as THREE from "three";
import { layers } from "./layers";
import { BlockModificationMode } from "@/module_bindings";

export type Tool = "build" | "erase" | "paint";

export interface GridRaycasterEvents {
  onHover?: (position: THREE.Vector3 | null) => void;
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
    const placementPosition = this.checkIntersection();

    this.lastHoveredPosition = placementPosition || this.lastHoveredPosition;

    if (this.events.onHover) {
      this.events.onHover(placementPosition);
    }
  }

  private onMouseClick(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }
    this.updateMousePosition(event);
    const placementPosition = this.checkIntersection();

    if (this.events.onClick) {
      this.events.onClick(placementPosition || this.lastHoveredPosition);
    }
  }

  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private checkIntersection(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    if (intersects.length > 0) {
      const intersection = intersects[0];

      if (intersection.object.userData.isBoundaryBox) {
        const point = intersection.point;
        const gridPos = new THREE.Vector3(
          Math.floor(point.x),
          Math.floor(point.y),
          Math.floor(point.z)
        );
        return gridPos;
      } else {
        const point = intersection.object.position.clone();
        const gridPos = new THREE.Vector3(
          Math.floor(point.x),
          Math.floor(point.y),
          Math.floor(point.z)
        );

        if (
          this.currentTool.tag === "Erase" ||
          this.currentTool.tag === "Paint"
        ) {
          return gridPos;
        } else {
          const normal = intersection.face?.normal;
          if (normal) {
            return gridPos.add(normal);
          }
          return gridPos;
        }
      }
    }
    return null;
  }

  public updateCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  public raycastAtMouse(): THREE.Vector3 | null {
    return this.checkIntersection();
  }

  public dispose(): void {
    this.removeEventListeners();
  }
}
