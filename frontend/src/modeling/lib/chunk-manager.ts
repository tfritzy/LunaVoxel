import * as THREE from "three";
import type { BlockModificationMode, ChunkData, Layer, Vector3 } from "@/state/types";
import { getChunkKey as getLayerChunkKey, type StateStore } from "@/state/store";
import { CHUNK_SIZE } from "@/state/constants";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";
import { Chunk } from "./chunk";

export class ChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private layers: Layer[] = [];
  private chunks: Map<string, Chunk> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private chunksWithPreview: Set<string> = new Set();
  private unsubscribe?: () => void;

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

  private getChunkMinPos(worldPos: Vector3): Vector3 {
    return {
      x: Math.floor(worldPos.x / CHUNK_SIZE) * CHUNK_SIZE,
      y: Math.floor(worldPos.y / CHUNK_SIZE) * CHUNK_SIZE,
      z: Math.floor(worldPos.z / CHUNK_SIZE) * CHUNK_SIZE,
    };
  }

  private getOrCreateChunk(minPos: Vector3): Chunk {
    const key = this.getChunkKey(minPos);
    let chunk = this.chunks.get(key);
    
    if (!chunk) {
      const size = {
        x: Math.min(CHUNK_SIZE, this.dimensions.x - minPos.x),
        y: Math.min(CHUNK_SIZE, this.dimensions.y - minPos.y),
        z: Math.min(CHUNK_SIZE, this.dimensions.z - minPos.z),
      };
     
      console.log("Creating a new chunk at", minPos, size);
      chunk = new Chunk(
        this.scene, 
        minPos, 
        size, 
        this.atlasData, 
        this.getMode
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

    const chunksByLayerId = new Map<string, ChunkData[]>();
    for (const chunkData of current.chunks.values()) {
      if (chunkData.projectId !== this.projectId) continue;
      const bucket = chunksByLayerId.get(chunkData.layerId);
      if (bucket) {
        bucket.push(chunkData);
      } else {
        chunksByLayerId.set(chunkData.layerId, [chunkData]);
      }
    }

    const nextWorldChunks = new Map<
      string,
      { minPos: Vector3; size: Vector3; voxels: Uint8Array; hasData: boolean }
    >();

    for (const layer of this.layers) {
      if (!layer.visible) continue;
      const layerChunks = chunksByLayerId.get(layer.id);
      if (!layerChunks) continue;

      for (const chunkData of layerChunks) {
        const key = this.getChunkKey(chunkData.minPos);
        let worldChunk = nextWorldChunks.get(key);
        if (!worldChunk) {
          worldChunk = {
            minPos: chunkData.minPos,
            size: chunkData.size,
            voxels: new Uint8Array(
              chunkData.size.x * chunkData.size.y * chunkData.size.z
            ),
            hasData: false,
          };
          nextWorldChunks.set(key, worldChunk);
        }

        const sourceVoxels = chunkData.voxels;
        for (let i = 0; i < sourceVoxels.length; i++) {
          const value = sourceVoxels[i];
          if (value > 0) {
            worldChunk.voxels[i] = value;
            worldChunk.hasData = true;
          }
        }
      }
    }

    for (const chunkKey of this.chunksWithPreview) {
      if (nextWorldChunks.has(chunkKey)) continue;
      const existingChunk = this.chunks.get(chunkKey);
      if (!existingChunk) continue;
      nextWorldChunks.set(chunkKey, {
        minPos: existingChunk.minPos,
        size: existingChunk.size,
        voxels: new Uint8Array(
          existingChunk.size.x *
            existingChunk.size.y *
            existingChunk.size.z
        ),
        hasData: false,
      });
    }

    for (const [key, chunkData] of nextWorldChunks.entries()) {
      if (!chunkData.hasData && !this.chunksWithPreview.has(key)) {
        nextWorldChunks.delete(key);
      }
    }

    const activeChunkKeys = new Set(nextWorldChunks.keys());
    for (const [key, chunkData] of nextWorldChunks.entries()) {
      const chunk = this.getOrCreateChunk(chunkData.minPos);
      chunk.setWorldData(chunkData.voxels);
      activeChunkKeys.add(key);
    }

    for (const [key, chunk] of this.chunks.entries()) {
      if (!activeChunkKeys.has(key)) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
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
          
          chunk.setPreviewData(previewFrame, copyMinX, copyMinY, copyMinZ, copyMaxX, copyMaxY, copyMaxZ);
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
  }

  public getBlockAtPosition(position: THREE.Vector3, layer: Layer): number | null {
    const chunkMinPos = this.getChunkMinPos(position);
    const layerChunk = this.stateStore
      .getState()
      .chunks.get(getLayerChunkKey(layer.id, chunkMinPos));
    if (!layerChunk) return 0;
    
    const localX = position.x - chunkMinPos.x;
    const localY = position.y - chunkMinPos.y;
    const localZ = position.z - chunkMinPos.z;
    
    const index =
      localX * layerChunk.size.y * layerChunk.size.z +
      localY * layerChunk.size.z +
      localZ;
    
    return layerChunk.voxels[index] || 0;
  }

  public getChunks(): Chunk[] {
    return Array.from(this.chunks.values());
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
