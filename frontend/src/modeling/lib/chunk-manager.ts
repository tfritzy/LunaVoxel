import * as THREE from "three";
import type { BlockModificationMode, VoxelObject, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { CHUNK_SIZE } from "@/state/constants";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./flat-voxel-frame";
import { Chunk } from "./chunk";

export class ChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private objects: VoxelObject[] = [];
  private objectVisibilityMap: Map<number, boolean> = new Map();
  private chunks: Map<string, Chunk> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private chunksWithPreview: Set<string> = new Set();
  private unsubscribe?: () => void;
  private readonly maxObjects = 10;

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
        this.maxObjects,
        this.atlasData, 
        this.getMode,
        (objectIndex: number) => {
          return this.objectVisibilityMap.get(objectIndex) ?? true;
        }
      );
      this.chunks.set(key, chunk); 
    }
    
    return chunk;
  }

  private handleStateChange = () => {
    const current = this.stateStore.getState();
    this.objects = current.objects
      .filter((obj) => obj.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    this.objectVisibilityMap.clear();
    for (const obj of this.objects) {
      this.objectVisibilityMap.set(obj.index, obj.visible);
    }

    const objectIndexById = new Map(
      this.objects.map((obj) => [obj.id, obj.index])
    );
    const nextChunkObjects = new Map<string, Set<number>>();

    for (const chunkData of current.chunks.values()) {
      if (chunkData.projectId !== this.projectId) continue;
      const objectIndex = objectIndexById.get(chunkData.objectId);
      if (objectIndex === undefined) continue;

      const chunk = this.getOrCreateChunk(chunkData.minPos);
      chunk.setObjectChunk(objectIndex, chunkData.voxels);
      const key = this.getChunkKey(chunkData.minPos);
      if (!nextChunkObjects.has(key)) {
        nextChunkObjects.set(key, new Set());
      }
      nextChunkObjects.get(key)?.add(objectIndex);
    }

    const activeObjectCount = Math.max(this.maxObjects, this.objects.length);

    for (const [key, chunk] of this.chunks.entries()) {
      const activeObjects = nextChunkObjects.get(key) ?? new Set<number>();
      for (let i = 0; i < activeObjectCount; i++) {
        if (!activeObjects.has(i) && chunk.getObjectChunk(i)) {
          chunk.setObjectChunk(i, null);
        }
      }
      if (chunk.isEmpty()) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }

    this.updateAllChunks();
  };

  public getObject(objectIndex: number): VoxelObject | undefined {
    return this.objects.find((o) => o.index === objectIndex);
  }

  public getObjectBounds(objectIndex: number): { min: Vector3; max: Vector3 } | null {
    const object = this.getObject(objectIndex);
    if (!object) {
      return null;
    }

    return {
      min: { ...object.position },
      max: {
        x: object.position.x + object.dimensions.x,
        y: object.position.y + object.dimensions.y,
        z: object.position.z + object.dimensions.z,
      },
    };
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

  public getBlockAtPosition(position: THREE.Vector3, obj: VoxelObject): number | null {
    const chunkMinPos = this.getChunkMinPos(position);
    const key = this.getChunkKey(chunkMinPos);
    const chunk = this.chunks.get(key);
    
    if (!chunk) return 0;
    
    const objectChunk = chunk.getObjectChunk(obj.index);
    if (!objectChunk) return 0;
    
    const localX = position.x - chunkMinPos.x;
    const localY = position.y - chunkMinPos.y;
    const localZ = position.z - chunkMinPos.z;
    
    const index = localX * chunk.size.y * chunk.size.z + localY * chunk.size.z + localZ;
    
    return objectChunk.voxels[index] || 0;
  }

  public getChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  public getVoxelAtWorldPos(x: number, y: number, z: number): number {
    const chunkMinPos = this.getChunkMinPos({ x, y, z });
    const key = this.getChunkKey(chunkMinPos);
    const chunk = this.chunks.get(key);
    
    if (!chunk) return 0;
    
    const localX = x - chunkMinPos.x;
    const localY = y - chunkMinPos.y;
    const localZ = z - chunkMinPos.z;
    
    return chunk.getVoxelAt(localX, localY, localZ);
  }

  public applyOptimisticRect(
    obj: VoxelObject,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    _rotation: number
  ) {
    void _rotation;
    if (obj.locked) return;

    const minX = Math.floor(Math.min(start.x, end.x));
    const maxX = Math.floor(Math.max(start.x, end.x));
    const minY = Math.floor(Math.min(start.y, end.y));
    const maxY = Math.floor(Math.max(start.y, end.y));
    const minZ = Math.floor(Math.min(start.z, end.z));
    const maxZ = Math.floor(Math.max(start.z, end.z));

    for (let chunkX = Math.floor(minX / CHUNK_SIZE) * CHUNK_SIZE; 
         chunkX <= maxX; 
         chunkX += CHUNK_SIZE) {
      for (let chunkY = Math.floor(minY / CHUNK_SIZE) * CHUNK_SIZE; 
           chunkY <= maxY; 
           chunkY += CHUNK_SIZE) {
        for (let chunkZ = Math.floor(minZ / CHUNK_SIZE) * CHUNK_SIZE; 
             chunkZ <= maxZ; 
             chunkZ += CHUNK_SIZE) {
          const chunk = this.getOrCreateChunk({ x: chunkX, y: chunkY, z: chunkZ });
          
          const localMinX = Math.max(0, minX - chunkX);
          const localMaxX = Math.min(chunk.size.x - 1, maxX - chunkX);
          const localMinY = Math.max(0, minY - chunkY);
          const localMaxY = Math.min(chunk.size.y - 1, maxY - chunkY);
          const localMinZ = Math.max(0, minZ - chunkZ);
          const localMaxZ = Math.min(chunk.size.z - 1, maxZ - chunkZ);

          chunk.applyOptimisticRect(
            obj.index,
            mode,
            localMinX, localMaxX,
            localMinY, localMaxY,
            localMinZ, localMaxZ,
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
