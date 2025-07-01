import * as THREE from "three";
import { addGroundPlane } from "./lib/add-ground-plane";
import { CameraController } from "./lib/camera-controller";
import { layers } from "./lib/layers";
import { DbConnection, Project } from "../module_bindings";
import { ProjectManager } from "./lib/project-manager";

export interface VoxelEngineOptions {
  container: HTMLElement;
  connection: DbConnection;
  project: Project;
  onGridPositionUpdate?: (position: THREE.Vector3 | null) => void;
}

export class VoxelEngine {
  public projectManager: ProjectManager;
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: CameraController;
  private animationFrameId: number | null = null;
  private conn: DbConnection;
  private project: Project;

  constructor(options: VoxelEngineOptions) {
    this.container = options.container;
    this.conn = options.connection;
    this.project = options.project;

    this.renderer = this.setupRenderer(this.container);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    this.camera = this.setupCamera();

    this.controls = new CameraController(
      this.camera,
      new THREE.Vector3(
        this.project.dimensions.x / 2,
        0,
        this.project.dimensions.z / 2
      ),
      this.renderer.domElement
    );
    this.setupLights();
    addGroundPlane(
      this.scene,
      this.project.dimensions.x,
      this.project.dimensions.y,
      this.project.dimensions.z
    );
    this.projectManager = new ProjectManager(
      this.scene,
      this.conn,
      this.project,
      this.camera,
      this.container
    );

    window.addEventListener("resize", this.handleResize);

    this.animate();
    this.setupPerformanceMonitoring();
  }

  public onColorSelected(color: number) {
    this.projectManager.setSelectedBlock(color);
  }

  private setupRenderer(container: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    return renderer;
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(25, 75, 50);
    directionalLight.shadow.mapSize.width = 8192;
    directionalLight.shadow.mapSize.height = 8192;
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 120;
    directionalLight.shadow.camera.left = -40;
    directionalLight.shadow.camera.right = 40;
    directionalLight.shadow.camera.top = 40;
    directionalLight.shadow.camera.bottom = -40;
    directionalLight.shadow.bias = -0.00000001;
    this.scene.add(directionalLight);
  }

  private setupCamera(): THREE.PerspectiveCamera {
    const floorCenter = new THREE.Vector3(
      this.project.dimensions.x / 2,
      0,
      this.project.dimensions.z / 2
    );

    const maxHorizontalDimension = Math.max(
      this.project.dimensions.x,
      this.project.dimensions.z
    );

    const fov = 75;
    const fovRadians = (fov * Math.PI) / 180;
    const horizontalDistance =
      maxHorizontalDimension / 2 / Math.tan(fovRadians / 2);

    const paddedDistance = horizontalDistance * 3;

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
      paddedDistance * 4
    );

    camera.layers.enable(layers.ghost);
    camera.position.copy(cameraPosition);
    camera.lookAt(floorCenter);

    return camera;
  }

  private setupPerformanceMonitoring(): void {
    const rendererStatsElement: HTMLDivElement = document.createElement("div");
    rendererStatsElement.style.position = "fixed";
    rendererStatsElement.style.right = "0";
    rendererStatsElement.style.bottom = "0";
    rendererStatsElement.style.padding = "10px";
    rendererStatsElement.style.color = "white";
    rendererStatsElement.style.fontFamily = "monospace";
    rendererStatsElement.style.fontSize = "12px";
    rendererStatsElement.style.zIndex = "100";
    rendererStatsElement.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    rendererStatsElement.style.borderRadius = "4px";
    this.container.appendChild(rendererStatsElement);

    // let frameCount: number = 0;
    // let lastFpsTime: number = performance.now();
    // let fps: number = 0;
    let frameTime: number = 0;
    let lastFrameStart: number = 0;
    let minFrameTime: number = Infinity;
    let maxFrameTime: number = 0;
    // let avgFrameTime: number = 0;
    const frameTimeHistory: number[] = [];
    const HISTORY_SIZE: number = 60;

    const updateStats = (): void => {
      const now: number = performance.now();

      if (lastFrameStart > 0) {
        frameTime = now - lastFrameStart;

        minFrameTime = Math.min(minFrameTime, frameTime);
        maxFrameTime = Math.max(maxFrameTime, frameTime);

        frameTimeHistory.push(frameTime);
        if (frameTimeHistory.length > HISTORY_SIZE) {
          frameTimeHistory.shift();
        }

        // avgFrameTime =
        //   frameTimeHistory.reduce((a: number, b: number) => a + b, 0) /
        //   frameTimeHistory.length;
      }
      lastFrameStart = now;

      // frameCount++;
      // if (now - lastFpsTime >= 1000) {
      //   // fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      //   frameCount = 0;
      //   lastFpsTime = now;

      //   minFrameTime = Infinity;
      //   maxFrameTime = 0;
      // }

      const info = this.renderer.info;
      rendererStatsElement.innerHTML = `
      <div>Draw calls: ${info.render.calls}</div>
      <div>Triangles: ${info.render.triangles.toLocaleString()}</div>
      <div>Geometries: ${info.memory.geometries}</div>
      <div>Textures: ${info.memory.textures}</div>
      }
    `;
    };

    const originalAnimate = this.animate;
    this.animate = (currentTime: number = 0): void => {
      originalAnimate.call(this, currentTime);
      updateStats();
    };
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
