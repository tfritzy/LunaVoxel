import * as THREE from "three";
import { addGroundPlane, updateBoundsVisibility } from "./lib/add-ground-plane";
import { CameraController, CameraState } from "./lib/camera-controller";
import { layers } from "./lib/layers";
import type { Project } from "@/state/types";
import type { StateStore } from "@/state/store";
import { ProjectManager } from "./lib/project-manager";
import { WebGPURayTracer } from "./lib/webgpu-ray-tracer";

export interface VoxelEngineOptions {
  container: HTMLElement;
  stateStore: StateStore;
  project: Project;
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
  private stateStore: StateStore;
  private project: Project;
  private boundsEdges: ReturnType<typeof addGroundPlane>["boundsEdges"] = [];
  private rayTracer: WebGPURayTracer | null = null;
  private rayTracingEnabled = false;
  private rayTraceCanvas: HTMLCanvasElement | null = null;
  private voxelWorldBuffer: Uint8Array;

  constructor(options: VoxelEngineOptions) {
    this.container = options.container;
    this.stateStore = options.stateStore;
    this.project = options.project;
    const d = this.project.dimensions;
    this.voxelWorldBuffer = new Uint8Array(d.x * d.y * d.z);

    this.renderer = this.setupRenderer(this.container);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x181826);

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

    if (options.initialCameraState) {
      this.controls.setCameraState(options.initialCameraState);
    }

    const { boundsEdges } = addGroundPlane(
      this.scene,
      this.project.dimensions.x,
      this.project.dimensions.y,
      this.project.dimensions.z
    );
    this.boundsEdges = boundsEdges;
    this.projectManager = new ProjectManager(
      this.scene,
      this.stateStore,
      this.project,
      this.camera,
      this.container
    );

    window.addEventListener("resize", this.handleResize);
    // this.setupPerformanceMonitoring();
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
    renderer.domElement.addEventListener("dragstart", (e) => e.preventDefault());
    renderer.domElement.style.userSelect = "none";
    renderer.domElement.style.webkitUserSelect = "none";
    renderer.domElement.style.pointerEvents = "auto";

    container.appendChild(renderer.domElement);
    return renderer;
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
      2000
    );

    camera.layers.enable(layers.ghost);
    camera.position.copy(cameraPosition);
    camera.lookAt(floorCenter);

    return camera;
  }

  public handleContainerResize(): void {
    this.handleResize();
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

    let frameCount: number = 0;
    let lastFpsTime: number = performance.now();
    let fps: number = 0;
    let frameTime: number = 0;
    let lastFrameStart: number = 0;
    let minFrameTime: number = Infinity;
    let maxFrameTime: number = 0;
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
      }
      lastFrameStart = now;

      frameCount++;
      if (now - lastFpsTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;

        minFrameTime = Infinity;
        maxFrameTime = 0;
      }

      const info = this.renderer.info;
      rendererStatsElement.innerHTML = `
      <div>Fps: ${fps}</div>
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
    this.projectManager.builder.resizeOverlayCanvas();

    if (this.rayTracer && this.rayTraceCanvas) {
      const w = this.container.clientWidth * window.devicePixelRatio;
      const h = this.container.clientHeight * window.devicePixelRatio;
      this.rayTracer.resize(Math.floor(w), Math.floor(h));
    }
  };

  async setRayTracingEnabled(enabled: boolean): Promise<void> {
    if (enabled === this.rayTracingEnabled) return;

    if (enabled) {
      if (!WebGPURayTracer.isSupported()) {
        console.warn("WebGPU is not supported in this browser");
        return;
      }

      this.rayTraceCanvas = document.createElement("canvas");
      const w = this.container.clientWidth * window.devicePixelRatio;
      const h = this.container.clientHeight * window.devicePixelRatio;
      this.rayTraceCanvas.width = Math.floor(w);
      this.rayTraceCanvas.height = Math.floor(h);
      this.rayTraceCanvas.style.display = "block";
      this.rayTraceCanvas.style.width = "100%";
      this.rayTraceCanvas.style.height = "100%";
      this.rayTraceCanvas.style.position = "absolute";
      this.rayTraceCanvas.style.top = "0";
      this.rayTraceCanvas.style.left = "0";

      this.rayTracer = await WebGPURayTracer.create(
        this.rayTraceCanvas,
        this.project.dimensions
      );

      const state = this.stateStore.getState();
      if (state.blocks.colors.length > 0) {
        this.rayTracer.updatePalette(state.blocks.colors);
      }

      this.renderer.domElement.style.display = "none";
      this.container.appendChild(this.rayTraceCanvas);
      this.rayTracingEnabled = true;
    } else {
      this.rayTracingEnabled = false;
      this.renderer.domElement.style.display = "block";

      if (this.rayTraceCanvas && this.container.contains(this.rayTraceCanvas)) {
        this.container.removeChild(this.rayTraceCanvas);
      }
      this.rayTraceCanvas = null;

      if (this.rayTracer) {
        this.rayTracer.dispose();
        this.rayTracer = null;
      }
    }
  }

  isRayTracingActive(): boolean {
    return this.rayTracingEnabled;
  }

  private gatherVoxelData(): void {
    const d = this.project.dimensions;
    const cm = this.projectManager.chunkManager;
    for (let x = 0; x < d.x; x++) {
      for (let y = 0; y < d.y; y++) {
        for (let z = 0; z < d.z; z++) {
          this.voxelWorldBuffer[x * d.y * d.z + y * d.z + z] =
            cm.getVoxelAtWorldPos(x, y, z);
        }
      }
    }
  }

  private lastFrameTime: number = 0;
  private animate = (currentTime: number = 0): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const deltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;
    this.controls.update(deltaTime);
    updateBoundsVisibility(this.camera.position, this.boundsEdges);

    if (this.rayTracingEnabled && this.rayTracer) {
      this.gatherVoxelData();
      this.rayTracer.updateVoxels(this.voxelWorldBuffer);

      const pos = this.camera.position;
      const target = this.controls.getTarget();
      this.rayTracer.updateCamera(
        [pos.x, pos.y, pos.z],
        [target.x, target.y, target.z],
        this.camera.fov
      );

      const state = this.stateStore.getState();
      if (state.blocks.colors.length > 0) {
        this.rayTracer.updatePalette(state.blocks.colors);
      }

      this.rayTracer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    this.projectManager.dispose();

    if (this.rayTracer) {
      this.rayTracer.dispose();
      this.rayTracer = null;
    }
    if (this.rayTraceCanvas && this.container.contains(this.rayTraceCanvas)) {
      this.container.removeChild(this.rayTraceCanvas);
    }
    this.rayTraceCanvas = null;

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
