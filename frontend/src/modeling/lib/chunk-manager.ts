import * as THREE from "three";
import type {
  BlockModificationMode,
  ChunkData,
  VoxelObject,
  Vector3,
} from "@/state/types";
import type { StateStore } from "@/state/store";
import { CHUNK_SIZE } from "@/state/constants";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";
import { Chunk } from "./chunk";

export class ChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private objects: VoxelObject[] = [];
  private objectVisibilityMap: Map<number, boolean> = new Map();
  private chunks: Map<string, Chunk> = new Map();
  private objectBoundsMap: Map<number, { min: Vector3; max: Vector3 }> = new Map();
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
    const nextObjectBounds = new Map<number, { min: Vector3; max: Vector3 }>();

    for (const chunkData of current.chunks.values()) {
      if (chunkData.projectId !== this.projectId) continue;
      const objectIndex = objectIndexById.get(chunkData.objectId);
      if (objectIndex === undefined) continue;
      this.updateObjectBounds(nextObjectBounds, objectIndex, chunkData);

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

    this.objectBoundsMap = nextObjectBounds;
    this.updateAllChunks();
  };

  public getObject(objectIndex: number): VoxelObject | undefined {
    return this.objects.find((o) => o.index === objectIndex);
  }

  public getObjectBounds(objectIndex: number): { min: Vector3; max: Vector3 } | null {
    if (!this.getObject(objectIndex)) {
      return null;
    }
    return this.objectBoundsMap.get(objectIndex) ?? null;
  }

  private updateObjectBounds(
    boundsMap: Map<number, { min: Vector3; max: Vector3 }>,
    objectIndex: number,
    chunkData: ChunkData
  ): void {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let x = 0; x < chunkData.size.x; x++) {
      for (let y = 0; y < chunkData.size.y; y++) {
        for (let z = 0; z < chunkData.size.z; z++) {
          const index = x * chunkData.size.y * chunkData.size.z + y * chunkData.size.z + z;
          if (chunkData.voxels[index] === 0) continue;

          const worldX = chunkData.minPos.x + x;
          const worldY = chunkData.minPos.y + y;
          const worldZ = chunkData.minPos.z + z;

          minX = Math.min(minX, worldX);
          minY = Math.min(minY, worldY);
          minZ = Math.min(minZ, worldZ);
          maxX = Math.max(maxX, worldX + 1);
          maxY = Math.max(maxY, worldY + 1);
          maxZ = Math.max(maxZ, worldZ + 1);
        }
      }
    }

    if (!Number.isFinite(minX)) {
      return;
    }

    const existing = boundsMap.get(objectIndex);
    if (!existing) {
      boundsMap.set(objectIndex, {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
      });
      return;
    }

    existing.min.x = Math.min(existing.min.x, minX);
    existing.min.y = Math.min(existing.min.y, minY);
    existing.min.z = Math.min(existing.min.z, minZ);
    existing.max.x = Math.max(existing.max.x, maxX);
    existing.max.y = Math.max(existing.max.y, maxY);
    existing.max.z = Math.max(existing.max.z, maxZ);
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
