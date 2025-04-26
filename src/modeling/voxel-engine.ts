import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { addGroundPlane } from "./lib/add-ground-plane";
import { GridRaycaster } from "./lib/grid-raycaster";
import { GridPosition } from "../types";
import { Builder } from "./lib/builder";

export interface VoxelEngineOptions {
  container: HTMLElement;
  onGridPositionUpdate?: (position: GridPosition | null) => void;
}

export class VoxelEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster: GridRaycaster | null = null;
  private builder: Builder;
  private animationFrameId: number | null = null;
  private currentGridPosition: GridPosition | null = null;

  constructor(options: VoxelEngineOptions) {
    this.container = options.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(10, 16, 10);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

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
        groundPlane,
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
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

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public getCurrentGridPosition(): GridPosition | null {
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
