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
      
      const minPos: Vector3 = {
        x: dbChunk.minPosX,
        y: dbChunk.minPosY,
        z: dbChunk.minPosZ,
      };
      
      const chunk = this.getOrCreateChunk(minPos);
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
    
    const minPos: Vector3 = {
      x: newChunk.minPosX,
      y: newChunk.minPosY,
      z: newChunk.minPosZ,
    };
    
    const chunk = this.getOrCreateChunk(minPos);
    chunk.setLayerChunk(layer.index, newChunk);
    
    this.updateChunk(minPos);
  };

  private onChunkDelete = (ctx: EventContext, deletedChunk: DbChunk) => {
    const layer = this.layers.find(l => l.id === deletedChunk.layerId);
    if (!layer) return;

    const minPos: Vector3 = {
      x: deletedChunk.minPosX,
      y: deletedChunk.minPosY,
      z: deletedChunk.minPosZ,
    };
    
    const key = this.getChunkKey(minPos);
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.setLayerChunk(layer.index, null);
      
      // If chunk is now empty, dispose it
      if (chunk.isEmpty()) {
        chunk.dispose();
        this.chunks.delete(key);
      } else {
        this.updateChunk(minPos);
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

  // TODO: Needs to handle multi-chunk world
  // public getMesh(): THREE.Mesh | null {
  //   const firstChunk = this.chunks.values().next().value;
  //   return firstChunk ? firstChunk.getMesh() : null;
  // }

  public applyOptimisticRect(
    layer: Layer,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) {
    if (layer.locked) return;

    // Iterate over the bounds and figure out which chunks they go into
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);

    // Find all affected chunks
    const affectedChunks = new Map<string, { chunk: Chunk; positions: Vector3[] }>();

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const worldPos: Vector3 = { x, y, z };
          const chunkMinPos = this.getChunkMinPos(worldPos);
          const key = this.getChunkKey(chunkMinPos);
          
          if (!affectedChunks.has(key)) {
            const chunk = this.getOrCreateChunk(chunkMinPos);
            affectedChunks.set(key, { chunk, positions: [] });
          }
          
          affectedChunks.get(key)!.positions.push(worldPos);
        }
      }
    }

    // Apply optimistic updates to each chunk
    for (const { chunk, positions } of affectedChunks.values()) {
      chunk.applyOptimisticRect(layer.index, mode, positions, blockType);
      
      // Update the chunk with current atlas
      if (this.atlasData) {
        const visibleLayerIndices = this.layers
          .filter(l => l.visible)
          .map(l => l.index);
        chunk.update(visibleLayerIndices, this.atlasData);
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
