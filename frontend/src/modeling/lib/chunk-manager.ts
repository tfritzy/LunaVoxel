import * as THREE from "three";
import { ToolType, Vector3 } from "@/module_bindings";
import { ChunkMesh } from "./chunk-mesh";
import { DecompressedLayer, DecompressedSelection } from "./project-manager";
import {
  setPreviewBit,
  clearPreviewBit,
  encodeBlockData,
  getBlockType,
  isPreview,
  isBlockPresent,
  getVersion,
  setSelectedBit,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import { calculateRectBounds } from "@/lib/rect-utils";

export const CHUNK_SIZE = 16;

export class ChunkManager {
  private scene: THREE.Scene;
  private chunkMesh: ChunkMesh;
  private dimensions: Vector3;
  private renderedBlocks: Uint32Array;
  private blocksToRender: Uint32Array;
  private currentUpdateId: number = 0;

  constructor(scene: THREE.Scene, dimensions: Vector3) {
    this.scene = scene;
    this.dimensions = dimensions;

    this.renderedBlocks = new Uint32Array(
      dimensions.x * dimensions.y * dimensions.z
    );
    this.blocksToRender = new Uint32Array(
      dimensions.x * dimensions.y * dimensions.z
    );

    this.chunkMesh = new ChunkMesh(this.scene, 0, 0, 0, dimensions, dimensions);
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

  private copyChunkData(blocks: Uint32Array): void {
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

  private clearBlocks(blocks: Uint32Array) {
    blocks.fill(0);
  }

  private addLayerToBlocks(
    layer: DecompressedLayer,
    blocks: Uint32Array
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

  private updatePreviewState(
    previewBlocks: Uint32Array,
    blocks: Uint32Array,
    buildMode: ToolType
  ): void {
    const isPaintMode = buildMode.tag === ToolType.Paint.tag;
    const isBuildMode = buildMode.tag === ToolType.Build.tag;
    const isEraseMode = buildMode.tag === ToolType.Erase.tag;

    for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
      const previewBlockValue = previewBlocks[voxelIndex];
      const hasPreview = isPreview(previewBlockValue);
      const realBlockValue = blocks[voxelIndex];
      const hasRealBlock = isBlockPresent(realBlockValue);

      if (isBuildMode) {
        if (hasPreview && hasRealBlock) {
          blocks[voxelIndex] = clearPreviewBit(previewBlockValue);
        } else if (hasPreview && !hasRealBlock) {
          blocks[voxelIndex] = setPreviewBit(previewBlockValue);
        } else if (!hasPreview && hasRealBlock) {
          blocks[voxelIndex] = clearPreviewBit(realBlockValue);
        }
      } else if (isEraseMode) {
        if (hasPreview && hasRealBlock) {
          blocks[voxelIndex] = setPreviewBit(realBlockValue);
        } else if (hasPreview && !hasRealBlock) {
          // leave it alone
        } else if (!hasPreview && hasRealBlock) {
          blocks[voxelIndex] = clearPreviewBit(realBlockValue);
        }
      } else if (isPaintMode) {
        if (hasPreview && hasRealBlock) {
          blocks[voxelIndex] = clearPreviewBit(previewBlockValue);
        } else if (hasPreview && !hasRealBlock) {
          blocks[voxelIndex] = 0;
        } else if (!hasPreview && hasRealBlock) {
          blocks[voxelIndex] = clearPreviewBit(realBlockValue);
        }
      }
    }
  }

  private updateSelectionState(
    selections: DecompressedSelection[],
    blocks: Uint32Array
  ): void {
    for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
      for (let i = 0; i < selections.length; i++) {
        if (selections[i].selectionData[voxelIndex] != 0) {
          const newVoxelPos = selections[i].selectionData[voxelIndex] - 1; // -1 bc 1 indexed
          blocks[newVoxelPos] = setSelectedBit(blocks[voxelIndex]);
          if (newVoxelPos != voxelIndex) {
            blocks[voxelIndex] = 0;
          }
        }
      }
    }
  }

  public applyOptimisticRect(
    layer: DecompressedLayer,
    tool: ToolType,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
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
          const currentVal = layer.voxels[idx];
          const currentType = getBlockType(currentVal);
          const currentVersion = getVersion(currentVal);

          switch (tool.tag) {
            case ToolType.Build.tag:
              layer.voxels[idx] = encodeBlockData(
                blockType,
                rotation,
                currentVersion + 1
              );
              break;
            case ToolType.Erase.tag:
              layer.voxels[idx] = encodeBlockData(0, 0, currentVersion + 1);
              break;
            case ToolType.Paint.tag:
              if (currentType !== 0) {
                layer.voxels[idx] = encodeBlockData(
                  blockType,
                  0,
                  currentVersion + 1
                );
              }
              break;
            default:
              break;
          }
        }
      }
    }
  }

  update = (
    layers: DecompressedLayer[],
    previewBlocks: Uint32Array,
    selections: DecompressedSelection[],
    buildMode: ToolType,
    atlasData: AtlasData
  ) => {
    try {
      const visibleLayers = layers
        .filter((layer) => layer.visible)
        .sort((l1, l2) => l2.index - l1.index);

      const visibleSelections = selections.filter(
        (s) => layers[s.layer]?.visible
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

      this.updatePreviewState(previewBlocks, this.blocksToRender, buildMode);
      this.updateSelectionState(visibleSelections, this.blocksToRender);

      // Check if any blocks changed
      let hasChanges = false;
      for (let i = 0; i < this.blocksToRender.length; i++) {
        if (this.blocksToRender[i] !== this.renderedBlocks[i]) {
          hasChanges = true;
          break;
        }
      }

      // Update the single chunk mesh if there are changes
      if (hasChanges) {
        this.copyChunkData(this.blocksToRender);
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
    this.chunkMesh.dispose();
  };
}
