import * as THREE from "three";
import { addGroundPlane } from "./lib/add-ground-plane";
import { GridRaycaster } from "./lib/grid-raycaster";
import { Builder } from "./lib/builder";
import { CameraController } from "./lib/camera-controller";
import { layers } from "./lib/layers";
import { BlockModificationMode, DbConnection, World } from "../module_bindings";
import { WorldManager } from "./lib/world-manager";

export interface VoxelEngineOptions {
  container: HTMLElement;
  connection: DbConnection;
  world: World;
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
  private conn: DbConnection;
  private worldManager: WorldManager;
  private world: World;

  constructor(options: VoxelEngineOptions) {
    this.container = options.container;
    this.conn = options.connection;
    this.world = options.world;

    this.renderer = this.setupRenderer(this.container);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.layers.enable(layers.ghost);
    this.camera.position.set(
      5 + this.world.xWidth / 2,
      12,
      5 + this.world.yWidth / 2
    );
    this.camera.lookAt(this.world.xWidth / 2, 0, this.world.yWidth / 2);

    this.controls = new CameraController(
      this.camera,
      new THREE.Vector3(this.world.xWidth / 2, 0, this.world.yWidth / 2),
      this.renderer.domElement
    );
    this.setupLights();
    addGroundPlane(
      this.scene,
      this.world.xWidth,
      this.world.yWidth,
      this.world.height
    );
    this.worldManager = new WorldManager(this.scene, this.conn, this.world);
    this.setupRaycaster();
    this.builder = new Builder(
      this.conn,
      this.renderer.domElement,
      this.world.id
    );

    window.addEventListener("resize", this.handleResize);

    this.animate();
    this.setupPerformanceMonitoring();
  }

  private setupRenderer(container: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    return renderer;
  }

  private setupRaycaster(): void {
    if (this.raycaster) {
      this.raycaster.dispose();
      this.raycaster = null;
    }

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

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
    directionalLight.position.set(10, 40, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 8192;
    directionalLight.shadow.mapSize.height = 8192;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    directionalLight.shadow.bias = -0.0001;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffeb, 0.4);
    fillLight.position.set(-15, 10, -10);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(5, 5, -20);
    this.scene.add(rimLight);
  }

  private setupPerformanceMonitoring(): void {
    const rendererStatsElement = document.createElement("div");
    rendererStatsElement.style.position = "fixed";
    rendererStatsElement.style.right = "0";
    rendererStatsElement.style.bottom = "0";
    rendererStatsElement.style.padding = "5px";
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
  };

  public getCurrentGridPosition(): THREE.Vector3 | null {
    return this.currentGridPosition;
  }

  public setTool(tool: BlockModificationMode): void {
    this.builder.setTool(tool);
    if (this.raycaster) {
      this.raycaster.setTool(tool);
    }
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
