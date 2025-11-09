import * as THREE from "three";
import {
  Vector3,
  DbConnection,
  EventContext,
  Layer,
  Chunk as DbChunk,
  Selection,
  BlockModificationMode,
} from "@/module_bindings";
import {
  decompressVoxelDataInto,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";
import { Chunk, CHUNK_SIZE } from "./chunk";
import { QueryRunner, TableHandle } from "@/lib/queryRunner";

export class ChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private dbConn: DbConnection;
  private projectId: string;
  private layers: Layer[] = [];
  private layerVisibilityMap: Map<number, boolean> = new Map();
  private layersQueryRunner: QueryRunner<Layer> | null = null;
  private chunks: Map<string, Chunk> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private chunksWithPreview: Set<string> = new Set();

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    dbConn: DbConnection,
    projectId: string,
    getMode: () => BlockModificationMode
  ) {
    this.scene = scene;
    this.dimensions = dimensions;
    this.dbConn = dbConn;
    this.projectId = projectId;
    this.getMode = getMode;

    this.dbConn.db.chunk.onInsert(this.onChunkInsert);
    this.dbConn.db.chunk.onUpdate(this.onChunkUpdate);
    this.dbConn.db.chunk.onDelete(this.onChunkDelete);

    this.dbConn.db.selections.onInsert(this.onSelectionInsert);
    this.dbConn.db.selections.onUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.onDelete(this.onSelectionDelete);

    this.initializeLayersQueryRunner();
    this.refreshChunks();
  }

  private initializeLayersQueryRunner(): void {
    const getTable = (db: DbConnection): TableHandle<Layer> => db.db.layer;
    const filter = (layer: Layer) => layer.projectId === this.projectId;
    
    this.layersQueryRunner = new QueryRunner<Layer>(
      getTable(this.dbConn),
      (layers) => {
        this.layers = layers.sort((a, b) => a.index - b.index);
        this.layerVisibilityMap.clear();
        for (const layer of this.layers) {
          this.layerVisibilityMap.set(layer.index, layer.visible);
        }
        this.updateAllChunks();
      },
      filter
    );
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
        10, 
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

  private refreshChunks = () => {
    const rawChunks = this.dbConn.db.chunk.tableCache.iter() as DbChunk[];
    
    for (const dbChunk of rawChunks) {
      if (dbChunk.projectId !== this.projectId) continue;
      
      const layer = this.layers.find(l => l.id === dbChunk.layerId);
      if (!layer) continue;
      
      const chunk = this.getOrCreateChunk({
        x: dbChunk.minPosX,
        y: dbChunk.minPosY,
        z: dbChunk.minPosZ,
      });
      chunk.setLayerChunk(layer.index, dbChunk);
    }
  };

  private onChunkInsert = (ctx: EventContext, newChunk: DbChunk) => {
    if (newChunk.projectId !== this.projectId) return;
    
    const layer = this.layers.find(l => l.id === newChunk.layerId);
    if (!layer) return;
    
    const chunk = this.getOrCreateChunk({
      x: newChunk.minPosX,
      y: newChunk.minPosY,
      z: newChunk.minPosZ,
    });
    chunk.setLayerChunk(layer.index, newChunk);
  };

  private onChunkUpdate = (ctx: EventContext, oldChunk: DbChunk, newChunk: DbChunk) => {
    if (newChunk.projectId !== this.projectId) return;

    const layer = this.layers.find(l => l.id === newChunk.layerId);
    if (!layer) return;
    const chunk = this.getOrCreateChunk({
      x: newChunk.minPosX,
      y: newChunk.minPosY,
      z: newChunk.minPosZ
    });
    chunk.setLayerChunk(layer.index, newChunk);    
  }

  private onChunkDelete = (ctx: EventContext, deletedChunk: DbChunk) => {
    if (deletedChunk.projectId !== this.projectId) return;
    
    const layer = this.layers.find(l => l.id === deletedChunk.layerId);
    if (!layer) return;

    const key = this.getChunkKey({
      x: deletedChunk.minPosX,
      y: deletedChunk.minPosY,
      z: deletedChunk.minPosZ,
    });
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.setLayerChunk(layer.index, null);
      
      if (chunk.isEmpty()) {
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  };

  private onSelectionInsert = (ctx: EventContext, newSelection: Selection) => {
    if (newSelection.projectId !== this.projectId) return;
    
    this.applySelectionToChunks(newSelection);
  };

  private onSelectionUpdate = (
    ctx: EventContext,
    oldSelection: Selection,
    newSelection: Selection
  ) => {
    if (newSelection.projectId !== this.projectId) return;
    
    this.applySelectionToChunks(newSelection);
  };

  private onSelectionDelete = (
    ctx: EventContext,
    deletedSelection: Selection
  ) => {
    if (deletedSelection.projectId !== this.projectId) return;
    
    const identityId = deletedSelection.identity.toHexString();
    for (const chunk of this.chunks.values()) {
      chunk.setSelectionFrame(identityId, null);
    }
  };

  private applySelectionToChunks(selection: Selection): void {
    const identityId = selection.identity.toHexString();
    
    for (const frame of selection.selectionFrames) {
      const chunkKey = this.getChunkKey(frame.minPos);
      const chunk = this.chunks.get(chunkKey);
      
      if (chunk) {
        frame.voxelData = decompressVoxelDataInto(frame.voxelData, new Uint8Array(0));
        
        chunk.setSelectionFrame(identityId, {
          layer: selection.layer,
          frame: frame,
          offset: { x: 0, y: 0, z: 0 }
        });
      }
    }
  }

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
    const key = this.getChunkKey(chunkMinPos);
    const chunk = this.chunks.get(key);
    
    if (!chunk) return 0; // No chunk means empty
    
    const layerChunk = chunk.getLayerChunk(layer.index);
    if (!layerChunk) return 0;
    
    const localX = position.x - chunkMinPos.x;
    const localY = position.y - chunkMinPos.y;
    const localZ = position.z - chunkMinPos.z;
    
    const index = localX * chunk.size.y * chunk.size.z + localY * chunk.size.z + localZ;
    
    return layerChunk.voxels[index] || 0;
  }

  public applyOptimisticRect(
    layer: Layer,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) {
    if (layer.locked) return;

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
            layer.index,
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
    this.dbConn.db.chunk.removeOnInsert(this.onChunkInsert);
    this.dbConn.db.chunk.removeOnDelete(this.onChunkDelete);
    this.dbConn.db.selections.removeOnInsert(this.onSelectionInsert);
    this.dbConn.db.selections.removeOnUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.removeOnDelete(this.onSelectionDelete);

    this.layersQueryRunner?.dispose();
    this.layersQueryRunner = null;

    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
    this.chunksWithPreview.clear();
  };
}
