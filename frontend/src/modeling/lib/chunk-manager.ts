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

export type DecompressedSelection = Omit<Selection, "selectionData"> & {
  selectionData: Uint8Array;
};

export class ChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private dbConn: DbConnection;
  private projectId: string;
  private layers: Layer[] = [];
  private layersQueryRunner: QueryRunner<Layer> | null = null;
  private chunks: Map<string, Chunk> = new Map();
  private selections: DecompressedSelection[] = [];
  private atlasData: AtlasData | null = null;

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    dbConn: DbConnection,
    projectId: string
  ) {
    this.scene = scene;
    this.dimensions = dimensions;
    this.dbConn = dbConn;
    this.projectId = projectId;

    // Subscribe to chunk updates - only insert and delete
    this.dbConn.db.chunk.onInsert(this.onChunkInsert);
    this.dbConn.db.chunk.onDelete(this.onChunkDelete);

    this.dbConn.db.selections.onInsert(this.onSelectionInsert);
    this.dbConn.db.selections.onUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.onDelete(this.onSelectionDelete);

    // Use QueryRunner for layers
    this.initializeLayersQueryRunner();
    this.refreshChunks();
    this.refreshSelections();
  }

  private initializeLayersQueryRunner(): void {
    const getTable = (db: DbConnection): TableHandle<Layer> => db.db.layer;
    const filter = (layer: Layer) => layer.projectId === this.projectId;
    
    this.layersQueryRunner = new QueryRunner<Layer>(
      getTable(this.dbConn),
      (layers) => {
        this.layers = layers.sort((a, b) => a.index - b.index);
      },
      filter
    );
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
      // Calculate chunk size (bounded by world dimensions)
      const size = {
        x: Math.min(CHUNK_SIZE, this.dimensions.x - minPos.x),
        y: Math.min(CHUNK_SIZE, this.dimensions.y - minPos.y),
        z: Math.min(CHUNK_SIZE, this.dimensions.z - minPos.z),
      };
      
      chunk = new Chunk(this.scene, minPos, size, 10); // Max 10 layers
      this.chunks.set(key, chunk);
      
      if (this.atlasData) {
        chunk.setTextureAtlas(this.atlasData);
      }
    }
    
    return chunk;
  }

  private refreshChunks = () => {
    const rawChunks = this.dbConn.db.chunk.tableCache.iter() as DbChunk[];
    
    for (const dbChunk of rawChunks) {
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

  private refreshSelections = () => {
    const rawSelections = (
      this.dbConn.db.selections.tableCache.iter() as Selection[]
    ).filter((s) => s.projectId === this.projectId);

    this.selections = rawSelections.map((selection) => {
      const existingSelection = this.selections.find((s) => s.id === selection.id);
      const buffer = existingSelection?.selectionData || new Uint8Array(0);
      return {
        ...selection,
        selectionData: decompressVoxelDataInto(selection.selectionData, buffer),
      };
    });
  };

  private onChunkInsert = (ctx: EventContext, newChunk: DbChunk) => {
    const layer = this.layers.find(l => l.id === newChunk.layerId);
    if (!layer) return;
    
    const chunk = this.getOrCreateChunk({
      x: newChunk.minPosX,
      y: newChunk.minPosY,
      z: newChunk.minPosZ,
    });
    chunk.setLayerChunk(layer.index, newChunk);
    
    this.updateChunk({
      x: newChunk.minPosX,
      y: newChunk.minPosY,
      z: newChunk.minPosZ,
    });
  };

  private onChunkDelete = (ctx: EventContext, deletedChunk: DbChunk) => {
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
      } else {
        this.updateChunk({
          x: deletedChunk.minPosX,
          y: deletedChunk.minPosY,
          z: deletedChunk.minPosZ,
        });
      }
    }
  };

  private onSelectionInsert = (ctx: EventContext, newSelection: Selection) => {
    if (newSelection.projectId !== this.projectId) return;
    if (this.selections.some((s) => s.id === newSelection.id)) return;

    const buffer = new Uint8Array(0);
    const decompressedSelection = {
      ...newSelection,
      selectionData: decompressVoxelDataInto(newSelection.selectionData, buffer),
    };
    this.selections = [...this.selections, decompressedSelection];
  };

  private onSelectionUpdate = (
    ctx: EventContext,
    oldSelection: Selection,
    newSelection: Selection
  ) => {
    if (newSelection.projectId !== this.projectId) return;

    const existingSelection = this.selections.find((s) => s.id === newSelection.id);
    const buffer = existingSelection?.selectionData || new Uint8Array(0);
    const decompressedSelection = {
      ...newSelection,
      selectionData: decompressVoxelDataInto(newSelection.selectionData, buffer),
    };
    this.selections = this.selections.map((s) =>
      s.id === newSelection.id ? decompressedSelection : s
    );
  };

  private onSelectionDelete = (
    ctx: EventContext,
    deletedSelection: Selection
  ) => {
    if (deletedSelection.projectId !== this.projectId) return;
    this.selections = this.selections.filter(
      (s) => s.id !== deletedSelection.id
    );
  };

  public getLayer(layerIndex: number): Layer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
  }

  private updateChunk(minPos: Vector3): void {
    const key = this.getChunkKey(minPos);
    const chunk = this.chunks.get(key);
    if (!chunk || !this.atlasData) return;

    // Get visible layer indices
    const visibleLayerIndices = this.layers
      .filter(l => l.visible)
      .map(l => l.index);

    chunk.update(visibleLayerIndices, this.atlasData);
  }

  private updateAllChunks(): void {
    if (!this.atlasData) return;

    const visibleLayerIndices = this.layers
      .filter(l => l.visible)
      .map(l => l.index);

    for (const chunk of this.chunks.values()) {
      chunk.update(visibleLayerIndices, this.atlasData);
    }
  }

  setTextureAtlas = (atlasData: AtlasData, buildMode: BlockModificationMode) => {
    this.atlasData = atlasData;
    
    // Update all existing chunks
    for (const chunk of this.chunks.values()) {
      chunk.setTextureAtlas(atlasData);
    }
    
    // Update all chunks with new atlas
    const visibleLayerIndices = this.layers
      .filter(l => l.visible)
      .map(l => l.index);

    for (const chunk of this.chunks.values()) {
      chunk.update(visibleLayerIndices, atlasData);
    }
  };

  public getChunkDimensions(): Vector3 {
    return { x: 1, y: 1, z: 1 };
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

    // Iterate in chunk-sized increments
    const chunkMinX = Math.floor(minX / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkMaxX = Math.floor(maxX / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkMinY = Math.floor(minY / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkMaxY = Math.floor(maxY / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkMinZ = Math.floor(minZ / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkMaxZ = Math.floor(maxZ / CHUNK_SIZE) * CHUNK_SIZE;

    for (let chunkX = chunkMinX; chunkX <= chunkMaxX; chunkX += CHUNK_SIZE) {
      for (let chunkY = chunkMinY; chunkY <= chunkMaxY; chunkY += CHUNK_SIZE) {
        for (let chunkZ = chunkMinZ; chunkZ <= chunkMaxZ; chunkZ += CHUNK_SIZE) {
          const chunk = this.getOrCreateChunk({ x: chunkX, y: chunkY, z: chunkZ });
          
          // Calculate bounds within this chunk
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
          
          if (this.atlasData) {
            const visibleLayerIndices = this.layers
              .filter(l => l.visible)
              .map(l => l.index);
            chunk.update(visibleLayerIndices, this.atlasData);
          }
        }
      }
    }
  }

  update = (
    previewFrame: VoxelFrame,
    buildMode: BlockModificationMode,
    atlasData: AtlasData
  ) => {
    // Store atlas data for future chunk updates
    this.atlasData = atlasData;
    // Chunks are updated via subscriptions, not via this method
  };

  dispose = () => {
    // Unsubscribe from database events
    this.dbConn.db.chunk.removeOnInsert(this.onChunkInsert);
    this.dbConn.db.chunk.removeOnDelete(this.onChunkDelete);
    this.dbConn.db.selections.removeOnInsert(this.onSelectionInsert);
    this.dbConn.db.selections.removeOnUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.removeOnDelete(this.onSelectionDelete);

    // Dispose QueryRunner
    this.layersQueryRunner?.dispose();
    this.layersQueryRunner = null;

    // Dispose all chunks
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
  };
}
