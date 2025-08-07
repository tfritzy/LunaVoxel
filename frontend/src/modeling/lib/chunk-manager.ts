import * as THREE from "three";
import {
  Atlas,
  BlockModificationMode,
  Layer,
  ProjectBlocks,
  Vector3,
} from "@/module_bindings";
import { ChunkMesh, CHUNK_SIZE } from "./chunk-mesh";
import { Block } from "./blocks";

interface ChunkCoordinate {
  x: number;
  z: number;
}

export class ChunkManager {
  private scene: THREE.Scene;
  private chunks: Map<string, ChunkMesh> = new Map();
  private textureAtlas: THREE.Texture | null = null;
  private dimensions: Vector3;
  private realBlocks: (Block | undefined)[][][];
  private previewBlocks: (Block | undefined)[][][];
  private previousPreviewBlocks: (Block | undefined)[][][];
  private currentUpdateId: number = 0;

  constructor(scene: THREE.Scene, dimensions: Vector3) {
    this.scene = scene;
    this.dimensions = dimensions;

    this.realBlocks = Array(dimensions.x)
      .fill(null)
      .map(() =>
        Array(dimensions.y)
          .fill(null)
          .map(() => Array(dimensions.z).fill(undefined))
      );

    this.previewBlocks = Array(dimensions.x)
      .fill(null)
      .map(() =>
        Array(dimensions.y)
          .fill(null)
          .map(() => Array(dimensions.z).fill(undefined))
      );

    this.previousPreviewBlocks = Array(dimensions.x)
      .fill(null)
      .map(() =>
        Array(dimensions.y)
          .fill(null)
          .map(() => Array(dimensions.z).fill(undefined))
      );
  }

  setTextureAtlas = (textureAtlas: THREE.Texture) => {
    this.textureAtlas = textureAtlas;
    for (const chunk of this.chunks.values()) {
      chunk.setTextureAtlas(textureAtlas);
    }
  };

  private clearBlocks(blocks: (Block | undefined)[][][]): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;
    for (let x = 0; x < xDim; x++) {
      for (let y = 0; y < yDim; y++) {
        for (let z = 0; z < zDim; z++) {
          blocks[x][y][z] = undefined;
        }
      }
    }
  }

  private decompressBlocksInto(
    rleBytes: Uint8Array,
    blocks: (Block | undefined)[][][]
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;
    const yzDim = yDim * zDim;

    this.clearBlocks(blocks);

    let byteIndex = 0;
    let blockIndex = 0;

    while (byteIndex < rleBytes.length) {
      const runLength = (rleBytes[byteIndex + 1] << 8) | rleBytes[byteIndex];
      const block = this.blockFromBytes(rleBytes, byteIndex + 2);
      const blockToAssign = block.type === 0 ? undefined : block;

      const endIndex = blockIndex + runLength;
      while (blockIndex < endIndex) {
        const x = Math.floor(blockIndex / yzDim);
        const y = Math.floor((blockIndex % yzDim) / zDim);
        const z = blockIndex % zDim;
        if (x < xDim && y < yDim && z < zDim) {
          blocks[x][y][z] = blockToAssign;
        }
        blockIndex++;
      }

      byteIndex += 4;
    }
  }

  private copyBlocksArray(
    source: (Block | undefined)[][][],
    target: (Block | undefined)[][][]
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;
    for (let x = 0; x < xDim; x++) {
      for (let y = 0; y < yDim; y++) {
        for (let z = 0; z < zDim; z++) {
          target[x][y][z] = source[x]?.[y]?.[z];
        }
      }
    }
  }

  private addLayerToBlocks(
    layer: Layer,
    blocks: (Block | undefined)[][][]
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;

    if (layer.xDim !== xDim || layer.yDim !== yDim || layer.zDim !== zDim) {
      return;
    }

    const yzDim = yDim * zDim;
    let byteIndex = 0;
    let blockIndex = 0;

    while (byteIndex < layer.voxels.length) {
      const runLength =
        (layer.voxels[byteIndex + 1] << 8) | layer.voxels[byteIndex];
      const block = this.blockFromBytes(layer.voxels, byteIndex + 2);

      if (block.type !== 0) {
        const endIndex = blockIndex + runLength;
        while (blockIndex < endIndex) {
          const x = Math.floor(blockIndex / yzDim);
          const y = Math.floor((blockIndex % yzDim) / zDim);
          const z = blockIndex % zDim;

          if (x < xDim && y < yDim && z < zDim && !blocks[x][y][z]) {
            blocks[x][y][z] = block;
          }
          blockIndex++;
        }
      } else {
        blockIndex += runLength;
      }

      byteIndex += 4;
    }
  }

  private blockFromBytes(bytes: Uint8Array, offset: number): Block {
    const combined = (bytes[offset] << 8) | bytes[offset + 1];
    const type = combined >> 6;
    const rotation = combined & 0x07;

    return { type, rotation };
  }

  private getChunkKey(chunkCoord: ChunkCoordinate): string {
    return `${chunkCoord.x},${chunkCoord.z}`;
  }

  private getChunkCoordinate(worldX: number, worldZ: number): ChunkCoordinate {
    return {
      x: Math.floor(worldX / CHUNK_SIZE),
      z: Math.floor(worldZ / CHUNK_SIZE),
    };
  }

  private getAllChunksInWorld = (): Set<string> => {
    const allChunks = new Set<string>();

    const chunksX = Math.ceil(this.dimensions.x / CHUNK_SIZE);
    const chunksZ = Math.ceil(this.dimensions.z / CHUNK_SIZE);

    for (let x = 0; x < chunksX; x++) {
      for (let z = 0; z < chunksZ; z++) {
        const chunkKey = this.getChunkKey({ x, z });
        allChunks.add(chunkKey);
      }
    }

    return allChunks;
  };

  private getChunksWithPreviewDeltas = (): Set<string> => {
    const chunksWithDeltas = new Set<string>();

    for (let x = 0; x < this.dimensions.x; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        for (let z = 0; z < this.dimensions.z; z++) {
          const currentBlock = this.previewBlocks[x][y][z];
          const previousBlock = this.previousPreviewBlocks[x][y][z];

          const blocksAreDifferent =
            (currentBlock && !previousBlock) ||
            (!currentBlock && previousBlock) ||
            (currentBlock &&
              previousBlock &&
              (currentBlock.type !== previousBlock.type ||
                currentBlock.rotation !== previousBlock.rotation));

          if (blocksAreDifferent) {
            const chunkCoord = this.getChunkCoordinate(x, z);
            const chunkKey = this.getChunkKey(chunkCoord);
            chunksWithDeltas.add(chunkKey);
          }
        }
      }
    }

    return chunksWithDeltas;
  };

  private extractChunkBlocks = (
    chunkCoord: ChunkCoordinate,
    worldBlocks: (Block | undefined)[][][]
  ): (Block | undefined)[][][] => {
    const chunkBlocks: (Block | undefined)[][][] = Array(CHUNK_SIZE)
      .fill(null)
      .map(() =>
        Array(this.dimensions.y)
          .fill(null)
          .map(() => Array(CHUNK_SIZE).fill(undefined))
      );

    const startX = chunkCoord.x * CHUNK_SIZE;
    const startZ = chunkCoord.z * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const worldX = startX + x;
          const worldZ = startZ + z;

          if (worldX < this.dimensions.x && worldZ < this.dimensions.z) {
            chunkBlocks[x][y][z] = worldBlocks[worldX][y][worldZ];
          }
        }
      }
    }

    return chunkBlocks;
  };

  private getOrCreateChunk = (
    chunkKey: string,
    chunkCoord: ChunkCoordinate
  ): ChunkMesh => {
    let chunk = this.chunks.get(chunkKey);
    if (!chunk) {
      chunk = new ChunkMesh(
        this.scene,
        chunkCoord.x,
        chunkCoord.z,
        this.dimensions.y,
        this.textureAtlas
      );
      this.chunks.set(chunkKey, chunk);
    }
    return chunk;
  };

  private updateChunks = (
    chunksToUpdate: Set<string>,
    buildMode: BlockModificationMode,
    blocks: ProjectBlocks,
    atlas: Atlas
  ) => {
    for (const chunkKey of chunksToUpdate) {
      const [x, z] = chunkKey.split(",").map(Number);
      const chunkCoord = { x, z };

      const chunk = this.getOrCreateChunk(chunkKey, chunkCoord);

      const chunkRealBlocks = this.extractChunkBlocks(
        chunkCoord,
        this.realBlocks
      );
      const chunkPreviewBlocks = this.extractChunkBlocks(
        chunkCoord,
        this.previewBlocks
      );

      chunk.update(
        chunkRealBlocks,
        chunkPreviewBlocks,
        buildMode,
        blocks,
        atlas
      );
    }
  };

  updateReal = async (
    layers: Layer[],
    buildMode: BlockModificationMode,
    blocks: ProjectBlocks,
    atlas: Atlas
  ) => {
    const updateId = ++this.currentUpdateId;

    try {
      const visibleLayers = layers.filter((layer) => layer.visible);

      if (visibleLayers.length === 0) {
        this.clearBlocks(this.realBlocks);
      } else {
        const firstLayer = visibleLayers[0];
        this.decompressBlocksInto(firstLayer.voxels, this.realBlocks);

        if (updateId !== this.currentUpdateId) return;

        for (let i = 1; i < visibleLayers.length; i++) {
          this.addLayerToBlocks(visibleLayers[i], this.realBlocks);
          if (updateId !== this.currentUpdateId) return;
        }
      }

      if (updateId !== this.currentUpdateId) return;

      const allChunks = this.getAllChunksInWorld();
      this.updateChunks(allChunks, buildMode, blocks, atlas);

      this.copyBlocksArray(this.previewBlocks, this.previousPreviewBlocks);
    } catch (error) {
      console.error(`[ChunkManager] Real update ${updateId} failed:`, error);
      throw error;
    }
  };

  updatePreview = async (
    previewBlocks: (Block | undefined)[][][],
    buildMode: BlockModificationMode,
    blocks: ProjectBlocks,
    atlas: Atlas
  ) => {
    const updateId = ++this.currentUpdateId;

    try {
      this.copyBlocksArray(previewBlocks, this.previewBlocks);

      if (updateId !== this.currentUpdateId) return;

      const chunksWithDeltas = this.getChunksWithPreviewDeltas();
      this.updateChunks(chunksWithDeltas, buildMode, blocks, atlas);

      this.copyBlocksArray(this.previewBlocks, this.previousPreviewBlocks);
    } catch (error) {
      console.error(`[ChunkManager] Preview update ${updateId} failed:`, error);
      throw error;
    }
  };

  dispose = () => {
    this.currentUpdateId++;

    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
  };
}
