import * as THREE from "three";
import {
  ToolType,
  Vector3,
  DbConnection,
  EventContext,
  Layer,
  Selection,
} from "@/module_bindings";
import { ChunkMesh } from "./chunk-mesh";
import {
  isBlockPresent,
  decompressVoxelData,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import { calculateRectBounds } from "@/lib/rect-utils";

export const CHUNK_SIZE = 16;

export type DecompressedLayer = Omit<Layer, "voxels"> & { voxels: Uint8Array };
export type DecompressedSelection = Omit<Selection, "selectionData"> & {
  selectionData: Uint8Array;
};

export class LegacyChunk {
  private scene: THREE.Scene;
  private chunkMesh: ChunkMesh;
  private dimensions: Vector3;
  private renderedBlocks: Uint8Array;
  private blocksToRender: Uint8Array;
  private previewFrame: Uint8Array;
  private selectionFrame: Uint8Array;
  private currentUpdateId: number = 0;
  private dbConn: DbConnection;
  private projectId: string;
  private layers: DecompressedLayer[] = [];
  private selections: DecompressedSelection[] = [];

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

    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    this.renderedBlocks = new Uint8Array(totalVoxels);
    this.blocksToRender = new Uint8Array(totalVoxels);
    this.previewFrame = new Uint8Array(totalVoxels);
    this.selectionFrame = new Uint8Array(totalVoxels);

    this.chunkMesh = new ChunkMesh(this.scene, 0, 0, 0, dimensions, dimensions);

    // Subscribe to database events
    this.dbConn.db.selections.onInsert(this.onSelectionInsert);
    this.dbConn.db.selections.onUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.onDelete(this.onSelectionDelete);

    this.dbConn.db.layer.onInsert(this.onLayerInsert);
    this.dbConn.db.layer.onUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.onDelete(this.onLayerDelete);

    // Initialize layers and selections
    this.refreshLayers();
    this.refreshSelections();
  }

  public getBlockAt(worldX: number, worldY: number, worldZ: number): number {
    if (
      worldX < 0 ||
      worldX >= this.dimensions.x ||
      worldY < 0 ||
      worldY >= this.dimensions.y ||
      worldZ < 0 ||
      worldZ >= this.dimensions.z
    ) {
      return 0;
    }

    return this.chunkMesh.getVoxel(worldX, worldY, worldZ);
  }

  private copyChunkData(blocks: Uint8Array): void {
    for (let x = 0; x < this.dimensions.x; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        for (let z = 0; z < this.dimensions.z; z++) {
          const blockIndex =
            x * this.dimensions.y * this.dimensions.z +
            y * this.dimensions.z +
            z;
          this.chunkMesh.setVoxel(x, y, z, blocks[blockIndex]);
        }
      }
    }
  }

  setTextureAtlas = (atlasData: AtlasData, buildMode: ToolType) => {
    this.chunkMesh.setTextureAtlas(atlasData);
    this.copyChunkData(this.renderedBlocks);
    this.chunkMesh.update(buildMode, atlasData);
  };

  public getChunkDimensions(): Vector3 {
    return { x: 1, y: 1, z: 1 };
  }

  public getChunk(
    chunkX: number,
    chunkY: number,
    chunkZ: number
  ): ChunkMesh | null {
    if (chunkX === 0 && chunkY === 0 && chunkZ === 0) {
      return this.chunkMesh;
    }
    return null;
  }

  private clearBlocks(blocks: Uint8Array) {
    blocks.fill(0);
  }

  private addLayerToBlocks(
    layer: DecompressedLayer,
    blocks: Uint8Array
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;

    if (layer.xDim !== xDim || layer.yDim !== yDim || layer.zDim !== zDim) {
      console.warn("Layer dimensions don't match world dimensions");
      return;
    }

    for (let i = 0; i < blocks.length; i++) {
      if (isBlockPresent(layer.voxels[i])) {
        blocks[i] = layer.voxels[i];
      }
    }
  }

  private updatePreviewFrame(
    previewFrame: Uint8Array,
    previewStart: Vector3 | null,
    previewDim: Vector3 | null,
    buildMode: ToolType
  ): void {
    this.previewFrame.fill(0);

    if (!previewStart || !previewDim || previewFrame.length === 0) return;

    const isPaintMode = buildMode.tag === ToolType.Paint.tag;
    const isBuildMode = buildMode.tag === ToolType.Build.tag;

    if (!isBuildMode && !isPaintMode) return;

    const yDim = this.dimensions.y;
    const zDim = this.dimensions.z;

    for (let x = 0; x < previewDim.x; x++) {
      for (let y = 0; y < previewDim.y; y++) {
        for (let z = 0; z < previewDim.z; z++) {
          const frameIndex = x * previewDim.y * previewDim.z + y * previewDim.z + z;
          const blockValue = previewFrame[frameIndex];
          
          if (blockValue > 0) {
            const worldX = previewStart.x + x;
            const worldY = previewStart.y + y;
            const worldZ = previewStart.z + z;
            const worldIndex = worldX * yDim * zDim + worldY * zDim + worldZ;
            
            this.previewFrame[worldIndex] = blockValue;
          }
        }
      }
    }
  }

  private updateSelectionFrame(
    selections: DecompressedSelection[]
  ): void {
    this.selectionFrame.fill(0);

    for (const selection of selections) {
      for (let i = 0; i < selection.selectionData.length; i++) {
        if (selection.selectionData[i] > 0) {
          this.selectionFrame[i] = 1;
        }
      }
    }
  }

  public applyOptimisticRect(
    layer: DecompressedLayer,
    tool: ToolType,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number
  ) {
    if (layer.locked) return;

    const layerDims = { x: layer.xDim, y: layer.yDim, z: layer.zDim };
    const bounds = calculateRectBounds(start, end, layerDims);

    const yDim = layer.yDim;
    const zDim = layer.zDim;

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const base = x * yDim * zDim + y * zDim;
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          const idx = base + z;

          switch (tool.tag) {
            case ToolType.Build.tag:
              layer.voxels[idx] = blockType & 0xFF;
              break;
            case ToolType.Erase.tag:
              layer.voxels[idx] = 0;
              break;
            case ToolType.Paint.tag:
              if (layer.voxels[idx] > 0) {
                layer.voxels[idx] = blockType & 0xFF;
              }
              break;
            default:
              break;
          }
        }
      }
    }
  }

  private decompressLayer = (layer: Layer): DecompressedLayer => {
    return {
      ...layer,
      voxels: decompressVoxelData(layer.voxels),
    };
  };

  private decompressSelection = (
    selection: Selection
  ): DecompressedSelection => {
    return {
      ...selection,
      selectionData: decompressVoxelData(selection.selectionData),
    };
  };

  private refreshLayers = () => {
    const rawLayers = (this.dbConn.db.layer.tableCache.iter() as Layer[])
      .filter((l) => l.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    this.layers = rawLayers.map(this.decompressLayer);
  };

  private refreshSelections = () => {
    const rawSelections = (
      this.dbConn.db.selections.tableCache.iter() as Selection[]
    ).filter((s) => s.projectId === this.projectId);

    this.selections = rawSelections.map(this.decompressSelection);
  };

  private onSelectionInsert = (ctx: EventContext, newSelection: Selection) => {
    if (newSelection.projectId !== this.projectId) return;
    if (this.selections.some((s) => s.id === newSelection.id)) return;

    const decompressedSelection = this.decompressSelection(newSelection);
    this.selections = [...this.selections, decompressedSelection];
  };

  private onSelectionUpdate = (
    ctx: EventContext,
    oldSelection: Selection,
    newSelection: Selection
  ) => {
    if (newSelection.projectId !== this.projectId) return;

    const decompressedSelection = this.decompressSelection(newSelection);
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

  private onLayerInsert = (ctx: EventContext, newLayer: Layer) => {
    if (newLayer.projectId !== this.projectId) return;
    if (this.layers.some((l) => l.id === newLayer.id)) return;

    const decompressedLayer = this.decompressLayer(newLayer);
    this.layers = [...this.layers, decompressedLayer].sort(
      (a, b) => a.index - b.index
    );
  };

  private onLayerUpdate = (
    ctx: EventContext,
    oldLayer: Layer,
    newLayer: Layer
  ) => {
    if (newLayer.projectId !== this.projectId) return;

    const decompressedLayer = this.decompressLayer(newLayer);
    this.layers = this.layers
      .map((l) => (l.id === newLayer.id ? decompressedLayer : l))
      .sort((a, b) => a.index - b.index);
  };

  private onLayerDelete = (ctx: EventContext, deletedLayer: Layer) => {
    if (deletedLayer.projectId !== this.projectId) return;
    this.layers = this.layers.filter((l) => l.id !== deletedLayer.id);
  };

  public getLayer(layerIndex: number): DecompressedLayer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
  }

  update = (
    previewFrame: Uint8Array,
    previewStart: Vector3 | null,
    previewDim: Vector3 | null,
    buildMode: ToolType,
    atlasData: AtlasData
  ) => {
    try {
      const visibleLayers = this.layers
        .filter((layer) => layer.visible)
        .sort((l1, l2) => l2.index - l1.index);

      const visibleSelections = this.selections.filter(
        (s) => this.layers[s.layer]?.visible
      );

      if (visibleLayers.length === 0) {
        this.clearBlocks(this.blocksToRender);
      } else {
        const firstLayer = visibleLayers[visibleLayers.length - 1];
        this.blocksToRender.set(firstLayer.voxels);

        for (let i = visibleLayers.length - 2; i >= 0; i--) {
          this.addLayerToBlocks(visibleLayers[i], this.blocksToRender);
        }
      }

      this.updatePreviewFrame(previewFrame, previewStart, previewDim, buildMode);
      this.updateSelectionFrame(visibleSelections);

      // Check if any blocks changed
      let hasChanges = false;
      for (let i = 0; i < this.blocksToRender.length; i++) {
        if (this.blocksToRender[i] !== this.renderedBlocks[i]) {
          hasChanges = true;
          break;
        }
      }

      // Check if preview or selection frames changed
      const previewChanged = this.previewFrame.some((v, i) => 
        v !== (this.chunkMesh as any).previewFrame?.[i]
      );
      const selectionChanged = this.selectionFrame.some((v, i) => 
        v !== (this.chunkMesh as any).selectionFrame?.[i]
      );

      // Update the single chunk mesh if there are changes
      if (hasChanges || previewChanged || selectionChanged) {
        this.copyChunkData(this.blocksToRender);
        this.chunkMesh.setPreviewFrame(this.previewFrame);
        this.chunkMesh.setSelectionFrame(this.selectionFrame);
        this.chunkMesh.update(buildMode, atlasData);
      }

      this.renderedBlocks.set(this.blocksToRender);
    } catch (error) {
      console.error(`[ChunkManager] Update failed:`, error);
      throw error;
    }
  };

  dispose = () => {
    this.currentUpdateId++;

    // Unsubscribe from database events
    this.dbConn.db.selections.removeOnInsert(this.onSelectionInsert);
    this.dbConn.db.selections.removeOnUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.removeOnDelete(this.onSelectionDelete);
    this.dbConn.db.layer.removeOnInsert(this.onLayerInsert);
    this.dbConn.db.layer.removeOnUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.removeOnDelete(this.onLayerDelete);

    this.chunkMesh.dispose();
  };
}
