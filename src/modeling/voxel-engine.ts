import * as THREE from "three";
import { addGroundPlane } from "./lib/add-ground-plane";
import { GridRaycaster } from "./lib/grid-raycaster";
import { Builder } from "./lib/builder";
import { CameraController } from "./lib/camera-controller";
import { layers } from "./lib/layers";

export interface VoxelEngineOptions {
  container: HTMLElement;
  onGridPositionUpdate?: (position: THREE.Vector3 | null) => void;
}

export class VoxelEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: CameraController;
  private raycaster: GridRaycaster | null = null;
  private builder: Builder;
  private animationFrameId: number | null = null;
  private currentGridPosition: THREE.Vector3 | null = null;

  constructor(options: VoxelEngineOptions) {
    this.container = options.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.layers.enable(layers.ghost);
    this.camera.position.set(10, 16, 10);
    this.camera.lookAt(0, 0, 0);

    this.controls = new CameraController(this.camera, this.renderer.domElement);

    this.setupLights();

    addGroundPlane(this.scene);

    this.builder = new Builder(this.scene);

    const groundPlane = this.scene.children.find(
      (child) =>
        child instanceof THREE.Mesh &&
        child.geometry instanceof THREE.PlaneGeometry
    ) as THREE.Mesh;

    if (groundPlane) {
      this.raycaster = new GridRaycaster(
        this.camera,
        this.scene,
        this.container,
        {
          onHover: (position) => {
            if (position) {
              this.builder.onMouseHover(position);
            }
          },
          onClick: (position) => {
            this.currentGridPosition = position;
            if (position) {
              this.builder.onMouseClick(position);
            }
          },
        }
      );
    }

    window.addEventListener("resize", this.handleResize);

    this.animate();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
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
    this.raycaster?.update();
  };

  public getCurrentGridPosition(): THREE.Vector3 | null {
    return this.currentGridPosition;
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener("resize", this.handleResize);
    this.raycaster?.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
