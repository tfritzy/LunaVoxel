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
  private objectVisibilityMap: Map<number, boolean> = new Map();
  private chunks: Map<string, Chunk> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  public readonly previewBuffer: Uint8Array;
  public readonly selectionBuffer: Uint8Array;
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
    this.selectionBuffer = new Uint8Array(dimensions.x * dimensions.y * dimensions.z);
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
        },
        this.previewBuffer,
        this.dimensions,
        this.selectionBuffer
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

    this.buildSelectionBuffer();
    this.updateAllChunks();
  };

  private buildSelectionBuffer(): void {
    this.selectionBuffer.fill(0);

    for (const obj of this.objects) {
      if (!obj.selection || !obj.visible) continue;

      const sel = obj.selection;
      const selDims = sel.getDimensions();
      const selMin = sel.getMinPos();
      const dimY = this.dimensions.y;
      const dimZ = this.dimensions.z;
      const yz = dimY * dimZ;

      for (let lx = 0; lx < selDims.x; lx++) {
        const wx = selMin.x + lx;
        if (wx < 0 || wx >= this.dimensions.x) continue;
        for (let ly = 0; ly < selDims.y; ly++) {
          const wy = selMin.y + ly;
          if (wy < 0 || wy >= dimY) continue;
          for (let lz = 0; lz < selDims.z; lz++) {
            const wz = selMin.z + lz;
            if (wz < 0 || wz >= dimZ) continue;
            const val = sel.get(wx, wy, wz);
            if (val > 0) {
              this.selectionBuffer[wx * yz + wy * dimZ + wz] = val;
            }
          }
        }
      }
    }
  }

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
  };
}
