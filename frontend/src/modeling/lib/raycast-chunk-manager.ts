import * as THREE from "three";
import type { BlockModificationMode, Layer, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { CHUNK_SIZE } from "@/state/constants";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";
import { RaycastChunk } from "./raycast-chunk";

export class RaycastChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private layers: Layer[] = [];
  private layerVisibilityMap: Map<number, boolean> = new Map();
  private chunks: Map<string, RaycastChunk> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private chunksWithPreview: Set<string> = new Set();
  private unsubscribe?: () => void;
  private readonly maxLayers = 10;

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    stateStore: StateStore,
    projectId: string,
    getMode: () => BlockModificationMode
  ) {
    this.scene = scene;
    this.dimensions = dimensions;
    this.stateStore = stateStore;
    this.projectId = projectId;
    this.getMode = getMode;
    this.handleStateChange();
    this.unsubscribe = this.stateStore.subscribe(this.handleStateChange);
  }

  private getChunkKey(minPos: Vector3): string {
    return `${minPos.x},${minPos.y},${minPos.z}`;
  }

  private updateAllChunks(): void {
    for (const chunk of this.chunks.values()) {
      chunk.update();
    }
  }

  private getChunkMinPos(worldPos: Vector3): Vector3 {
    return {
      x: Math.floor(worldPos.x / CHUNK_SIZE) * CHUNK_SIZE,
      y: Math.floor(worldPos.y / CHUNK_SIZE) * CHUNK_SIZE,
      z: Math.floor(worldPos.z / CHUNK_SIZE) * CHUNK_SIZE,
    };
  }

  private getOrCreateChunk(minPos: Vector3): RaycastChunk {
    const key = this.getChunkKey(minPos);
    let chunk = this.chunks.get(key);

    if (!chunk) {
      const size = {
        x: Math.min(CHUNK_SIZE, this.dimensions.x - minPos.x),
        y: Math.min(CHUNK_SIZE, this.dimensions.y - minPos.y),
        z: Math.min(CHUNK_SIZE, this.dimensions.z - minPos.z),
      };

      console.log("Creating a new raycast chunk at", minPos, size);
      chunk = new RaycastChunk(
        this.scene,
        minPos,
        size,
        this.maxLayers,
        this.atlasData,
        this.getMode,
        (layerIndex: number) => {
          return this.layerVisibilityMap.get(layerIndex) ?? true;
        }
      );
      this.chunks.set(key, chunk);
    }

    return chunk;
  }

  private handleStateChange = () => {
    const current = this.stateStore.getState();
    this.layers = current.layers
      .filter((layer) => layer.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    this.layerVisibilityMap.clear();
    for (const layer of this.layers) {
      this.layerVisibilityMap.set(layer.index, layer.visible);
    }

    const layerIndexById = new Map(
      this.layers.map((layer) => [layer.id, layer.index])
    );
    const nextChunkLayers = new Map<string, Set<number>>();

    for (const chunkData of current.chunks.values()) {
      if (chunkData.projectId !== this.projectId) continue;
      const layerIndex = layerIndexById.get(chunkData.layerId);
      if (layerIndex === undefined) continue;

      const chunk = this.getOrCreateChunk(chunkData.minPos);
      chunk.setLayerChunk(layerIndex, chunkData.voxels);
      const key = this.getChunkKey(chunkData.minPos);
      if (!nextChunkLayers.has(key)) {
        nextChunkLayers.set(key, new Set());
      }
      nextChunkLayers.get(key)?.add(layerIndex);
    }

    const activeLayerCount = Math.max(this.maxLayers, this.layers.length);

    for (const [key, chunk] of this.chunks.entries()) {
      const activeLayers = nextChunkLayers.get(key) ?? new Set<number>();
      for (let i = 0; i < activeLayerCount; i++) {
        if (!activeLayers.has(i) && chunk.getLayerChunk(i)) {
          chunk.setLayerChunk(i, null);
        }
      }
      if (chunk.isEmpty()) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }

    this.updateAllChunks();
  };

  public getLayer(layerIndex: number): Layer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
  }

  setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;

    for (const chunk of this.chunks.values()) {
      chunk.setTextureAtlas(atlasData);
    }
  };

  setPreview = (previewFrame: VoxelFrame) => {
    const frameMinPos = previewFrame.getMinPos();
    const frameMaxPos = previewFrame.getMaxPos();

    const minChunkX = Math.floor(frameMinPos.x / CHUNK_SIZE) * CHUNK_SIZE;
    const minChunkY = Math.floor(frameMinPos.y / CHUNK_SIZE) * CHUNK_SIZE;
    const minChunkZ = Math.floor(frameMinPos.z / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkX = Math.floor((frameMaxPos.x - 1) / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkY = Math.floor((frameMaxPos.y - 1) / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkZ = Math.floor((frameMaxPos.z - 1) / CHUNK_SIZE) * CHUNK_SIZE;

    const currentChunksWithPreview = new Set<string>();

    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += CHUNK_SIZE) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += CHUNK_SIZE) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += CHUNK_SIZE) {
          const chunkMinPos = { x: chunkX, y: chunkY, z: chunkZ };
          const chunkKey = this.getChunkKey(chunkMinPos);
          const chunk = this.getOrCreateChunk(chunkMinPos);

          const copyMinX = Math.max(chunkX, frameMinPos.x);
          const copyMinY = Math.max(chunkY, frameMinPos.y);
          const copyMinZ = Math.max(chunkZ, frameMinPos.z);
          const copyMaxX = Math.min(chunkX + chunk.size.x, frameMaxPos.x);
          const copyMaxY = Math.min(chunkY + chunk.size.y, frameMaxPos.y);
          const copyMaxZ = Math.min(chunkZ + chunk.size.z, frameMaxPos.z);

          chunk.setPreviewData(
            previewFrame,
            copyMinX,
            copyMinY,
            copyMinZ,
            copyMaxX,
            copyMaxY,
            copyMaxZ
          );
          currentChunksWithPreview.add(chunkKey);
        }
      }
    }

    for (const chunkKey of this.chunksWithPreview) {
      if (!currentChunksWithPreview.has(chunkKey)) {
        const chunk = this.chunks.get(chunkKey);
        if (chunk) {
          chunk.clearPreviewData();
        }
      }
    }

    this.chunksWithPreview = currentChunksWithPreview;
  };

  public getBlockAtPosition(
    position: THREE.Vector3,
    layer: Layer
  ): number | null {
    const chunkMinPos = this.getChunkMinPos(position);
    const key = this.getChunkKey(chunkMinPos);
    const chunk = this.chunks.get(key);

    if (!chunk) return 0;

    const layerChunk = chunk.getLayerChunk(layer.index);
    if (!layerChunk) return 0;

    const localX = position.x - chunkMinPos.x;
    const localY = position.y - chunkMinPos.y;
    const localZ = position.z - chunkMinPos.z;

    const index =
      localX * chunk.size.y * chunk.size.z + localY * chunk.size.z + localZ;

    return layerChunk.voxels[index] || 0;
  }

  public getChunks(): RaycastChunk[] {
    return Array.from(this.chunks.values());
  }

  public applyOptimisticRect(
    layer: Layer,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    _rotation: number
  ) {
    void _rotation;
    if (layer.locked) return;

    const minX = Math.floor(Math.min(start.x, end.x));
    const maxX = Math.floor(Math.max(start.x, end.x));
    const minY = Math.floor(Math.min(start.y, end.y));
    const maxY = Math.floor(Math.max(start.y, end.y));
    const minZ = Math.floor(Math.min(start.z, end.z));
    const maxZ = Math.floor(Math.max(start.z, end.z));

    for (
      let chunkX = Math.floor(minX / CHUNK_SIZE) * CHUNK_SIZE;
      chunkX <= maxX;
      chunkX += CHUNK_SIZE
    ) {
      for (
        let chunkY = Math.floor(minY / CHUNK_SIZE) * CHUNK_SIZE;
        chunkY <= maxY;
        chunkY += CHUNK_SIZE
      ) {
        for (
          let chunkZ = Math.floor(minZ / CHUNK_SIZE) * CHUNK_SIZE;
          chunkZ <= maxZ;
          chunkZ += CHUNK_SIZE
        ) {
          const chunk = this.getOrCreateChunk({
            x: chunkX,
            y: chunkY,
            z: chunkZ,
          });

          const localMinX = Math.max(0, minX - chunkX);
          const localMaxX = Math.min(chunk.size.x - 1, maxX - chunkX);
          const localMinY = Math.max(0, minY - chunkY);
          const localMaxY = Math.min(chunk.size.y - 1, maxY - chunkY);
          const localMinZ = Math.max(0, minZ - chunkZ);
          const localMaxZ = Math.min(chunk.size.z - 1, maxZ - chunkZ);

          chunk.applyOptimisticRect(
            layer.index,
            mode,
            localMinX,
            localMaxX,
            localMinY,
            localMaxY,
            localMinZ,
            localMaxZ,
            blockType
          );
        }
      }
    }
  }

  dispose = () => {
    this.unsubscribe?.();
    this.unsubscribe = undefined;

    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
    this.chunksWithPreview.clear();
  };
}
