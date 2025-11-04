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

export type DecompressedSelection = Omit<Selection, "selectionData"> & {
  selectionData: Uint8Array;
};

/**
 * Manages multiple Chunk instances and handles subscriptions to the database
 */
export class ChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private dbConn: DbConnection;
  private projectId: string;
  private layers: Layer[] = [];
  private chunks: Map<string, Chunk> = new Map(); // keyed by chunk minPos as "x,y,z"
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

    // Subscribe to chunk updates
    this.dbConn.db.chunk.onInsert(this.onChunkInsert);
    this.dbConn.db.chunk.onUpdate(this.onChunkUpdate);
    this.dbConn.db.chunk.onDelete(this.onChunkDelete);

    this.dbConn.db.selections.onInsert(this.onSelectionInsert);
    this.dbConn.db.selections.onUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.onDelete(this.onSelectionDelete);

    // Use queryRunner for layers instead of lifecycle events
    this.refreshLayers();
    this.refreshChunks();
    this.refreshSelections();
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

  private refreshLayers = () => {
    // Use queryRunner pattern for layers
    this.layers = (this.dbConn.db.layer.tableCache.iter() as Layer[])
      .filter((l) => l.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);
  };

  private refreshChunks = () => {
    const rawChunks = this.dbConn.db.chunk.tableCache.iter() as DbChunk[];
    
    // Only load chunks that belong to layers in this project
    const projectLayerIds = new Set(this.layers.map(l => l.id));
    
    for (const dbChunk of rawChunks) {
      if (projectLayerIds.has(dbChunk.layerId)) {
        const minPos = {
          x: dbChunk.minPosX,
          y: dbChunk.minPosY,
          z: dbChunk.minPosZ,
        };
        
        const chunk = this.getOrCreateChunk(minPos);
        
        // Find the layer index for this chunk
        const layer = this.layers.find(l => l.id === dbChunk.layerId);
        if (layer) {
          chunk.setLayerChunk(layer.index, dbChunk);
        }
      }
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
    // Only load chunks for layers in this project
    const layer = this.layers.find(l => l.id === newChunk.layerId);
    if (!layer) return;
    
    const minPos = {
      x: newChunk.minPosX,
      y: newChunk.minPosY,
      z: newChunk.minPosZ,
    };
    
    const chunk = this.getOrCreateChunk(minPos);
    chunk.setLayerChunk(layer.index, newChunk);
    
    this.updateChunk(minPos);
  };

  private onChunkUpdate = (
    ctx: EventContext,
    oldChunk: DbChunk,
    newChunk: DbChunk
  ) => {
    // Only update chunks for layers in this project
    const layer = this.layers.find(l => l.id === newChunk.layerId);
    if (!layer) return;

    const minPos = {
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

    const minPos = {
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
    
    this.updateAllChunks();
  };

  public getChunkDimensions(): Vector3 {
    return { x: 1, y: 1, z: 1 };
  }

  public getMesh(): THREE.Mesh | null {
    // Return the first chunk's mesh (for compatibility)
    const firstChunk = this.chunks.values().next().value;
    return firstChunk ? firstChunk.getMesh() : null;
  }

  // applyOptimisticRect is no longer supported with chunk-based storage
  public applyOptimisticRect(
    _layer: Layer,
    _mode: BlockModificationMode,
    _start: THREE.Vector3,
    _end: THREE.Vector3,
    _blockType: number,
    _rotation: number
  ) {
    // Note: Optimistic updates are no longer supported
    // The server will handle updates and we'll receive them via subscriptions
  }

  update = (
    previewFrame: VoxelFrame,
    buildMode: BlockModificationMode,
    atlasData: AtlasData
  ) => {
    this.atlasData = atlasData;
    this.updateAllChunks();
  };

  dispose = () => {
    // Unsubscribe from database events
    this.dbConn.db.chunk.removeOnInsert(this.onChunkInsert);
    this.dbConn.db.chunk.removeOnUpdate(this.onChunkUpdate);
    this.dbConn.db.chunk.removeOnDelete(this.onChunkDelete);
    this.dbConn.db.selections.removeOnInsert(this.onSelectionInsert);
    this.dbConn.db.selections.removeOnUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.removeOnDelete(this.onSelectionDelete);

    // Dispose all chunks
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
  };
}
