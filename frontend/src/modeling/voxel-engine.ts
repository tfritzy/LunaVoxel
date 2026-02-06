import * as THREE from "three";
import { addGroundPlane } from "./lib/add-ground-plane";
import { CameraController, CameraState } from "./lib/camera-controller";
import { layers } from "./lib/layers";
import { ProjectManager } from "./lib/project-manager";
import type { Vector3 } from "@/state";

export interface VoxelEngineOptions {
  container: HTMLElement;
  dimensions: Vector3;
  onGridPositionUpdate?: (position: THREE.Vector3 | null) => void;
  initialCameraState?: CameraState;
}

export class VoxelEngine {
  public projectManager;
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: CameraController;
  private animationFrameId: number | null = null;
  private dimensions: Vector3;

  constructor(options: VoxelEngineOptions) {
    this.container = options.container;
    this.dimensions = options.dimensions;

    this.renderer = this.setupRenderer(this.container);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x181826);

    this.camera = this.setupCamera();

    this.controls = new CameraController(
      this.camera,
      new THREE.Vector3(
        this.dimensions.x / 2,
        0,
        this.dimensions.z / 2
      ),
      this.renderer.domElement
    );

    if (options.initialCameraState) {
      this.controls.setCameraState(options.initialCameraState);
    }

    addGroundPlane(
      this.scene,
      this.dimensions.x,
      this.dimensions.y,
      this.dimensions.z
    );
    this.projectManager = new ProjectManager(
      this.scene,
      this.dimensions,
      this.camera,
      this.container
    );

    window.addEventListener("resize", this.handleResize);
    this.animate();
  }

  getCameraState(): CameraState {
    return this.controls.getCameraState();
  }

  private setupRenderer(container: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.minWidth = "0";
    renderer.domElement.style.minHeight = "0";
    renderer.domElement.style.maxWidth = "100%";
    renderer.domElement.style.maxHeight = "100%";

    renderer.domElement.draggable = false;
    renderer.domElement.style.userSelect = "none";
    renderer.domElement.style.webkitUserSelect = "none";
    renderer.domElement.style.pointerEvents = "auto";

    container.appendChild(renderer.domElement);
    return renderer;
  }

  private setupCamera(): THREE.PerspectiveCamera {
    const floorCenter = new THREE.Vector3(
      this.dimensions.x / 2,
      0,
      this.dimensions.z / 2
    );

    const maxHorizontalDimension = Math.max(
      this.dimensions.x,
      this.dimensions.z
    );

    const fov = 50;
    const fovRadians = (fov * Math.PI) / 180;
    const horizontalDistance =
      maxHorizontalDimension / 2 / Math.tan(fovRadians / 2);

    const paddedDistance = horizontalDistance;

    const cameraHeight = paddedDistance;
    const cameraPosition = new THREE.Vector3(
      floorCenter.x,
      cameraHeight,
      floorCenter.z + paddedDistance
    );

    const camera = new THREE.PerspectiveCamera(
      fov,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      300
    );

    camera.layers.enable(layers.ghost);
    camera.position.copy(cameraPosition);
    camera.lookAt(floorCenter);

    return camera;
  }

  public handleContainerResize(): void {
    this.handleResize();
  }

  private handleResize = (): void => {
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
  };

  private lastFrameTime: number = 0;
  private animate = (currentTime: number = 0): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;
    this.controls.update(deltaTime);
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    this.projectManager.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
