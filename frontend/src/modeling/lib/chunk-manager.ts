import * as THREE from "three";
import type { BlockModificationMode, VoxelObject, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { CHUNK_SIZE } from "@/state/constants";
import { AtlasData } from "@/lib/useAtlas";
import { Chunk } from "./chunk";

export class ChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private objects: VoxelObject[] = [];
  private objectSlotMap: Map<string, number> = new Map();
  private objectVisibilityMap: Map<number, boolean> = new Map();
  private chunks: Map<string, Chunk> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  public readonly previewBuffer: Uint8Array;
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
    this.previewBuffer = new Uint8Array(dimensions.x * dimensions.y * dimensions.z);
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
      const size = { x: CHUNK_SIZE, y: CHUNK_SIZE, z: CHUNK_SIZE };

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
        },
        this.previewBuffer,
        this.dimensions
      );
      this.chunks.set(key, chunk); 
    }
    
    return chunk;
  }

  private handleStateChange = () => {
    const current = this.stateStore.getState();
    this.syncObjects(current);
    const activeChunkObjects = this.syncChunkData(current);
    this.removeStaleChunks(activeChunkObjects);
    this.updateAllChunks();
  };

  private syncObjects(current: ReturnType<StateStore["getState"]>): void {
    this.objects = current.objects
      .filter((obj) => obj.projectId === this.projectId);

    this.objectSlotMap.clear();
    this.objectVisibilityMap.clear();
    for (let i = 0; i < this.objects.length; i++) {
      this.objectSlotMap.set(this.objects[i].id, i);
      this.objectVisibilityMap.set(i, this.objects[i].visible);
    }
  }

  private syncChunkData(current: ReturnType<StateStore["getState"]>): Map<string, Set<number>> {
    const activeChunkObjects = new Map<string, Set<number>>();

    for (const chunkData of current.chunks.values()) {
      if (chunkData.projectId !== this.projectId) continue;
      const objSlot = this.objectSlotMap.get(chunkData.objectId);
      if (objSlot === undefined) continue;
      const obj = this.objects[objSlot];

      const worldMinPos = {
        x: chunkData.minPos.x + obj.position.x,
        y: chunkData.minPos.y + obj.position.y,
        z: chunkData.minPos.z + obj.position.z,
      };

      const chunk = this.getOrCreateChunk(worldMinPos);
      chunk.setObjectChunk(objSlot, chunkData.voxels);
      chunk.setSelectionChunkFrame(chunkData.selection);
      const key = this.getChunkKey(worldMinPos);
      if (!activeChunkObjects.has(key)) {
        activeChunkObjects.set(key, new Set());
      }
      activeChunkObjects.get(key)?.add(objSlot);
    }

    return activeChunkObjects;
  }

  private removeStaleChunks(activeChunkObjects: Map<string, Set<number>>): void {
    const activeObjectCount = Math.max(this.maxObjects, this.objects.length);

    for (const [key, chunk] of this.chunks.entries()) {
      const activeObjects = activeChunkObjects.get(key) ?? new Set<number>();
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
  }

  public getObjectById(objectId: string): VoxelObject | undefined {
    const slot = this.objectSlotMap.get(objectId);
    return slot !== undefined ? this.objects[slot] : undefined;
  }

  public getObjectContentBounds(objectId: string): { min: Vector3; max: Vector3 } | null {
    const slot = this.objectSlotMap.get(objectId);
    if (slot === undefined) return null;
    const object = this.objects[slot];

    const state = this.stateStore.getState();
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let hasContent = false;

    for (const chunkData of state.chunks.values()) {
      if (chunkData.objectId !== object.id) continue;

      for (let x = 0; x < chunkData.size.x; x++) {
        for (let y = 0; y < chunkData.size.y; y++) {
          for (let z = 0; z < chunkData.size.z; z++) {
            const idx = x * chunkData.size.y * chunkData.size.z + y * chunkData.size.z + z;
            if (chunkData.voxels[idx] !== 0) {
              const wx = chunkData.minPos.x + x + object.position.x;
              const wy = chunkData.minPos.y + y + object.position.y;
              const wz = chunkData.minPos.z + z + object.position.z;
              if (wx < minX) minX = wx;
              if (wy < minY) minY = wy;
              if (wz < minZ) minZ = wz;
              if (wx + 1 > maxX) maxX = wx + 1;
              if (wy + 1 > maxY) maxY = wy + 1;
              if (wz + 1 > maxZ) maxZ = wz + 1;
              hasContent = true;
            }
          }
        }
      }
    }

    if (!hasContent) return null;

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    };
  }

  setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;
    
    for (const chunk of this.chunks.values()) {
      chunk.setTextureAtlas(atlasData);
    }
  };

  public getDimensions(): Vector3 {
    return this.dimensions;
  }

  updatePreview = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => {
    const minChunkX = Math.floor(minX / CHUNK_SIZE) * CHUNK_SIZE;
    const minChunkY = Math.floor(minY / CHUNK_SIZE) * CHUNK_SIZE;
    const minChunkZ = Math.floor(minZ / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkX = Math.floor(maxX / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkY = Math.floor(maxY / CHUNK_SIZE) * CHUNK_SIZE;
    const maxChunkZ = Math.floor(maxZ / CHUNK_SIZE) * CHUNK_SIZE;

    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += CHUNK_SIZE) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY += CHUNK_SIZE) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += CHUNK_SIZE) {
          const chunkMinPos = { x: chunkX, y: chunkY, z: chunkZ };
          const chunk = this.getOrCreateChunk(chunkMinPos);
          chunk.expandPreviewBounds(minX, minY, minZ, maxX, maxY, maxZ);
          chunk.update();
        }
      }
    }
  }

  clearPreview = () => {
    for (const chunk of this.chunks.values()) {
      if (chunk.hasPreviewBounds()) {
        chunk.resetPreviewBounds();
        chunk.update();
      }
    }
  }

  public getBlockAtPosition(position: THREE.Vector3, objectId: string): number | null {
    const chunkMinPos = this.getChunkMinPos(position);
    const key = this.getChunkKey(chunkMinPos);
    const chunk = this.chunks.get(key);
    
    if (!chunk) return 0;
    
    const objSlot = this.objectSlotMap.get(objectId);
    if (objSlot === undefined) return 0;
    const objectChunk = chunk.getObjectChunk(objSlot);
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
            this.objectSlotMap.get(obj.id) ?? -1,
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
  };
}
