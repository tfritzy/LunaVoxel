import * as THREE from "three";
import { addGroundPlane } from "./lib/add-ground-plane";
import { GridRaycaster } from "./lib/grid-raycaster";
import { Builder } from "./lib/builder";
import { CameraController } from "./lib/camera-controller";
import { layers } from "./lib/layers";
import { DbConnection, World as WorldData } from "../module_bindings";
import { World } from "./lib/world";

export interface VoxelEngineOptions {
  container: HTMLElement;
  connection: DbConnection;
  onGridPositionUpdate?: (position: THREE.Vector3 | null) => void;
  worldId: string;
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
  private conn: DbConnection;
  private worldManager: World;
  private worldId: string;
  private worldData: WorldData | null = null;

  constructor(options: VoxelEngineOptions) {
    this.container = options.container;
    this.conn = options.connection;
    this.worldId = options.worldId;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
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
    this.camera.position.set(5, 12, 5);
    this.camera.lookAt(0, 0, 0);

    this.controls = new CameraController(this.camera, this.renderer.domElement);

    this.setupLights();

    this.worldManager = new World(this.scene, this.conn);
    this.builder = new Builder(
      this.scene,
      this.conn,
      this.renderer.domElement,
      this.worldId
    );
    this.initChunks();

    window.addEventListener("resize", this.handleResize);

    this.animate();
    this.setupPerformanceMonitoring();
  }

  private setupRaycaster(): void {
    if (this.raycaster) {
      this.raycaster.dispose();
      this.raycaster = null;
    }

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
  }

  initChunks() {
    const chunks = Array.from(this.conn.db.chunk.iter()).filter(
      (chunk) => chunk.world === this.worldId
    );

    if (chunks.length === 0) {
      console.warn(
        "No chunks found for this world! Check world creation logic."
      );
    }

    const worldData = this.conn.db.world.id.find(this.worldId);

    if (worldData && !this.worldData) {
      this.worldData = worldData;

      addGroundPlane(this.scene, worldData.xWidth, worldData.yWidth);

      this.setupRaycaster();
    }

    this.worldManager.onQueriesApplied();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 30, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 8192;
    directionalLight.shadow.mapSize.height = 8192;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    directionalLight.shadow.bias = -0.0005;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffeb, 0.3);
    fillLight.position.set(-15, 10, -10);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(5, 5, -20);
    this.scene.add(rimLight);
  }

  private setupPerformanceMonitoring(): void {
    const rendererStatsElement = document.createElement("div");
    rendererStatsElement.style.position = "fixed";
    rendererStatsElement.style.left = "0";
    rendererStatsElement.style.bottom = "0";
    rendererStatsElement.style.padding = "5px";
    rendererStatsElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    rendererStatsElement.style.color = "white";
    rendererStatsElement.style.fontFamily = "monospace";
    rendererStatsElement.style.fontSize = "12px";
    rendererStatsElement.style.zIndex = "100";
    this.container.appendChild(rendererStatsElement);

    const updateRendererStats = () => {
      const info = this.renderer.info;
      rendererStatsElement.innerHTML = `
      Draw calls: ${info.render.calls}<br>
      Triangles: ${info.render.triangles.toLocaleString()}<br>
      Geometries: ${info.memory.geometries}<br>
      Textures: ${info.memory.textures}
    `;
    };

    const originalAnimate = this.animate;
    this.animate = (currentTime: number = 0) => {
      originalAnimate(currentTime);
      updateRendererStats();
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
    this.raycaster?.update();
  };

  public getCurrentGridPosition(): THREE.Vector3 | null {
    return this.currentGridPosition;
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.builder.dispose();
    window.removeEventListener("resize", this.handleResize);
    this.raycaster?.dispose();
    this.renderer.dispose();
    this.worldManager.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
