import * as THREE from "three";
import {
    Atlas,
    BlockModificationMode,
    Layer,
    ProjectBlocks,
    Vector3,
} from "@/module_bindings";
import { ChunkMesh } from "./chunk-mesh";

export const CHUNK_SIZE = 16;

export class ChunkManager {
    private scene: THREE.Scene;
    private chunks: ChunkMesh[][][];
    private textureAtlas: THREE.Texture | null = null;
    private dimensions: Vector3;
    private renderedBlocks: Uint16Array;
    private blocksToRender: Uint16Array;
    private currentUpdateId: number = 0;
    private chunkDimensions: Vector3;

    constructor(scene: THREE.Scene, dimensions: Vector3) {
        this.scene = scene;
        this.dimensions = dimensions;

        this.renderedBlocks = new Uint16Array(dimensions.x * dimensions.y * dimensions.z);
        this.blocksToRender = new Uint16Array(dimensions.x * dimensions.y * dimensions.z);

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
                        dimensions,
                        this.textureAtlas
                    );
                }
            }
        }
    }

    private copyChunkData(chunkX: number, chunkY: number, chunkZ: number, blocks: Uint16Array): void {
        const chunk = this.chunks[chunkX][chunkY][chunkZ];
        const chunkDims = chunk.getChunkDimensions();

        for (let x = 0; x < chunkDims.x; x++) {
            for (let y = 0; y < chunkDims.y; y++) {
                for (let z = 0; z < chunkDims.z; z++) {
                    const worldX = chunkX * CHUNK_SIZE + x;
                    const worldY = chunkY * CHUNK_SIZE + y;
                    const worldZ = chunkZ * CHUNK_SIZE + z;

                    const blockIndex = worldX * this.dimensions.y * this.dimensions.z + worldY * this.dimensions.z + worldZ;
                    chunk.setVoxel(x, y, z, blocks[blockIndex]);
                }
            }
        }
    }

    setTextureAtlas = (textureAtlas: THREE.Texture) => {
        this.textureAtlas = textureAtlas;
        for (let chunkX = 0; chunkX < this.chunkDimensions.x; chunkX++) {
            for (let chunkY = 0; chunkY < this.chunkDimensions.y; chunkY++) {
                for (let chunkZ = 0; chunkZ < this.chunkDimensions.z; chunkZ++) {
                    this.chunks[chunkX][chunkY][chunkZ].setTextureAtlas(textureAtlas);
                }
            }
        }
    };

    private clearBlocks(blocks: Uint16Array) {
        blocks.fill(0);
    }

    private decompressBlocksInto(
        rleBytes: Uint8Array,
        blocks: Uint16Array,
    ): void {
        let byteIndex = 0;
        let blockIndex = 0;

        while (byteIndex < rleBytes.length) {
            const runLength = (rleBytes[byteIndex + 1] << 8) | rleBytes[byteIndex];
            const blockByte1 = rleBytes[byteIndex + 2];
            const blockByte2 = rleBytes[byteIndex + 3];
            const combined = (blockByte1 << 8) | blockByte2;

            const endIndex = blockIndex + runLength;

            while (blockIndex < endIndex) {
                blocks[blockIndex] = combined;
                blockIndex++;
            }

            byteIndex += 4;
        }
    }

    private addLayerToBlocks(
        layer: Layer,
        blocks: Uint16Array,
    ): void {
        const { x: xDim, y: yDim, z: zDim } = this.dimensions;

        if (layer.xDim !== xDim || layer.yDim !== yDim || layer.zDim !== zDim) {
            return;
        }

        let byteIndex = 0;
        let blockIndex = 0;

        while (byteIndex < layer.voxels.length) {
            const runLength = (layer.voxels[byteIndex + 1] << 8) | layer.voxels[byteIndex];
            const blockByte1 = layer.voxels[byteIndex + 2];
            const blockByte2 = layer.voxels[byteIndex + 3];
            const combined = (blockByte1 << 8) | blockByte2;
            const blockType = combined >> 6;

            if (blockType !== 0) {
                const endIndex = blockIndex + runLength;
                while (blockIndex < endIndex) {
                    if (blocks[blockIndex] === 0) {
                        blocks[blockIndex] = combined;
                    }
                    blockIndex++;
                }
            } else {
                blockIndex += runLength;
            }

            byteIndex += 4;
        }
    }

    private updatePreviewState(
        previewBlocks: Uint16Array,
        blocks: Uint16Array,
        buildMode: BlockModificationMode,
    ): void {
        const isPaintMode = buildMode.tag === BlockModificationMode.Paint.tag;

        for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
            const hasPreview = previewBlocks[voxelIndex] !== 0;
            const currentBlock = blocks[voxelIndex];
            const hasRealBlock = currentBlock !== 0;

            if (hasPreview) {
                // In paint mode, only apply preview if there's a real block to paint
                if (isPaintMode && !hasRealBlock) {
                    // Don't apply preview - can't paint on nothing
                    blocks[voxelIndex] &= ~0x08;
                } else {
                    blocks[voxelIndex] = previewBlocks[voxelIndex];
                }
            } else {
                blocks[voxelIndex] &= ~0x08;
            }
        }
    }

    update = (
        layers: Layer[],
        previewBlocks: Uint16Array,
        buildMode: BlockModificationMode,
        blocks: ProjectBlocks,
        atlas: Atlas
    ) => {
        try {
            const visibleLayers = layers.filter((layer) => layer.visible);

            if (visibleLayers.length === 0) {
                this.clearBlocks(this.blocksToRender);
            } else {
                const firstLayer = visibleLayers[0];
                this.decompressBlocksInto(firstLayer.voxels, this.blocksToRender);

                for (let i = 1; i < visibleLayers.length; i++) {
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
                const [chunkX, chunkY, chunkZ] = chunkKey.split(',').map(Number);
                this.copyChunkData(chunkX, chunkY, chunkZ, this.blocksToRender);
                this.chunks[chunkX][chunkY][chunkZ].update(buildMode, blocks, atlas);
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