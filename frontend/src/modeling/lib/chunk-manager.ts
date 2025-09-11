import * as THREE from "three";
import { BlockModificationMode, Vector3 } from "@/module_bindings";
import { ChunkMesh } from "./chunk-mesh";
import { DecompressedLayer } from "./project-manager";
import {
  setPreviewBit,
  clearPreviewBit,
  encodeBlockData,
  getBlockType,
  isPreview,
  isBlockPresent,
  getVersion,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";

export const CHUNK_SIZE = 16;

export class ChunkManager {
  private scene: THREE.Scene;
  private chunks: ChunkMesh[][][];
  private dimensions: Vector3;
  private renderedBlocks: Uint32Array;
  private blocksToRender: Uint32Array;
  private currentUpdateId: number = 0;
  private chunkDimensions: Vector3;
  private editBuffer: Uint32Array | null = null;

  constructor(scene: THREE.Scene, dimensions: Vector3) {
    this.scene = scene;
    this.dimensions = dimensions;

    this.renderedBlocks = new Uint32Array(
      dimensions.x * dimensions.y * dimensions.z
    );
    this.blocksToRender = new Uint32Array(
      dimensions.x * dimensions.y * dimensions.z
    );

    this.chunkDimensions = {
      x: Math.ceil(dimensions.x / CHUNK_SIZE),
      y: Math.ceil(dimensions.y / CHUNK_SIZE),
      z: Math.ceil(dimensions.z / CHUNK_SIZE),
    };

    this.chunks = [];
    for (let chunkX = 0; chunkX < this.chunkDimensions.x; chunkX++) {
      this.chunks[chunkX] = [];
      for (let chunkY = 0; chunkY < this.chunkDimensions.y; chunkY++) {
        this.chunks[chunkX][chunkY] = [];
        for (let chunkZ = 0; chunkZ < this.chunkDimensions.z; chunkZ++) {
          const chunkDims: Vector3 = {
            x: Math.min(CHUNK_SIZE, dimensions.x - chunkX * CHUNK_SIZE),
            y: Math.min(CHUNK_SIZE, dimensions.y - chunkY * CHUNK_SIZE),
            z: Math.min(CHUNK_SIZE, dimensions.z - chunkZ * CHUNK_SIZE),
          };

          this.chunks[chunkX][chunkY][chunkZ] = new ChunkMesh(
            this.scene,
            chunkX,
            chunkY,
            chunkZ,
            chunkDims,
            dimensions
          );
        }
      }
    }
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

    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkY = Math.floor(worldY / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);

    const localX = worldX % CHUNK_SIZE;
    const localY = worldY % CHUNK_SIZE;
    const localZ = worldZ % CHUNK_SIZE;

    const chunk = this.chunks[chunkX]?.[chunkY]?.[chunkZ];
    if (!chunk) {
      return 0;
    }

    return chunk.getVoxel(localX, localY, localZ);
  }

  private copyChunkData(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    blocks: Uint32Array
  ): void {
    const chunk = this.chunks[chunkX][chunkY][chunkZ];
    const chunkDims = chunk.getChunkDimensions();

    for (let x = 0; x < chunkDims.x; x++) {
      for (let y = 0; y < chunkDims.y; y++) {
        for (let z = 0; z < chunkDims.z; z++) {
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldY = chunkY * CHUNK_SIZE + y;
          const worldZ = chunkZ * CHUNK_SIZE + z;

          const blockIndex =
            worldX * this.dimensions.y * this.dimensions.z +
            worldY * this.dimensions.z +
            worldZ;
          chunk.setVoxel(x, y, z, blocks[blockIndex]);
        }
      }
    }
  }

  setTextureAtlas = (
    atlasData: AtlasData,
    buildMode: BlockModificationMode
  ) => {
    for (let chunkX = 0; chunkX < this.chunkDimensions.x; chunkX++) {
      for (let chunkY = 0; chunkY < this.chunkDimensions.y; chunkY++) {
        for (let chunkZ = 0; chunkZ < this.chunkDimensions.z; chunkZ++) {
          this.chunks[chunkX][chunkY][chunkZ].setTextureAtlas(atlasData);
          this.copyChunkData(chunkX, chunkY, chunkZ, this.renderedBlocks);
          this.chunks[chunkX][chunkY][chunkZ].update(buildMode, atlasData);
        }
      }
    }
  };

  public getChunkDimensions(): Vector3 {
    return this.chunkDimensions;
  }

  public getChunk(
    chunkX: number,
    chunkY: number,
    chunkZ: number
  ): ChunkMesh | null {
    if (
      chunkX >= 0 &&
      chunkX < this.chunkDimensions.x &&
      chunkY >= 0 &&
      chunkY < this.chunkDimensions.y &&
      chunkZ >= 0 &&
      chunkZ < this.chunkDimensions.z
    ) {
      return this.chunks[chunkX][chunkY][chunkZ];
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
    buildMode: BlockModificationMode
  ): void {
    const isPaintMode = buildMode.tag === BlockModificationMode.Paint.tag;
    const isBuildMode = buildMode.tag === BlockModificationMode.Build.tag;
    const isEraseMode = buildMode.tag === BlockModificationMode.Erase.tag;

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

  public applyOptimisticRect(
    layer: DecompressedLayer,
    tool: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) {
    if (layer.locked) return;

    const minX = Math.max(0, Math.min(start.x, end.x));
    const maxX = Math.min(layer.xDim - 1, Math.max(start.x, end.x));
    const minY = Math.max(0, Math.min(start.y, end.y));
    const maxY = Math.min(layer.yDim - 1, Math.max(start.y, end.y));
    const minZ = Math.max(0, Math.min(start.z, end.z));
    const maxZ = Math.min(layer.zDim - 1, Math.max(start.z, end.z));

    const yDim = layer.yDim;
    const zDim = layer.zDim;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const base = x * yDim * zDim + y * zDim;
        for (let z = minZ; z <= maxZ; z++) {
          const idx = base + z;
          const currentVal = layer.voxels[idx];
          const currentType = getBlockType(currentVal);
          const currentVersion = getVersion(currentVal);

          switch (tool.tag) {
            case BlockModificationMode.Build.tag:
              layer.voxels[idx] = encodeBlockData(
                blockType,
                rotation,
                currentVersion + 1
              );
              break;
            case BlockModificationMode.Erase.tag:
              layer.voxels[idx] = encodeBlockData(0, 0, currentVersion + 1);
              break;
            case BlockModificationMode.Paint.tag:
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
    buildMode: BlockModificationMode,
    atlasData: AtlasData
  ) => {
    try {
      const visibleLayers = layers
        .filter((layer) => layer.visible)
        .sort((l1, l2) => l2.index - l1.index);

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

      const chunksToUpdate = new Set<string>();

      for (let i = 0; i < this.blocksToRender.length; i++) {
        if (this.blocksToRender[i] !== this.renderedBlocks[i]) {
          const z = i % this.dimensions.z;
          const y = Math.floor(i / this.dimensions.z) % this.dimensions.y;
          const x = Math.floor(i / (this.dimensions.y * this.dimensions.z));

          const chunkX = Math.floor(x / CHUNK_SIZE);
          const chunkY = Math.floor(y / CHUNK_SIZE);
          const chunkZ = Math.floor(z / CHUNK_SIZE);

          const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
          chunksToUpdate.add(chunkKey);
        }
      }

      for (const chunkKey of chunksToUpdate) {
        const [chunkX, chunkY, chunkZ] = chunkKey.split(",").map(Number);
        this.copyChunkData(chunkX, chunkY, chunkZ, this.blocksToRender);
        this.chunks[chunkX][chunkY][chunkZ].update(buildMode, atlasData);
      }

      this.renderedBlocks.set(this.blocksToRender);
    } catch (error) {
      console.error(`[ChunkManager] Update failed:`, error);
      throw error;
    }
  };

  dispose = () => {
    this.currentUpdateId++;

    for (let chunkX = 0; chunkX < this.chunkDimensions.x; chunkX++) {
      for (let chunkY = 0; chunkY < this.chunkDimensions.y; chunkY++) {
        for (let chunkZ = 0; chunkZ < this.chunkDimensions.z; chunkZ++) {
          this.chunks[chunkX][chunkY][chunkZ].dispose();
        }
      }
    }
  };
}
