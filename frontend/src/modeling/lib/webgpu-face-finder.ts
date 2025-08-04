import { Atlas, BlockModificationMode, ProjectBlocks } from "@/module_bindings";
import * as THREE from "three";
import { VoxelFaces } from "./layer-mesh";
import { Block } from "./blocks";

const COMPUTE_SHADER_SOURCE = `
@group(0) @binding(0) var<storage, read> blockData: array<u32>;
@group(0) @binding(1) var<storage, read> blockFaceAtlas: array<u32>;
@group(0) @binding(2) var<storage, read_write> outputFaces: array<u32>;
@group(0) @binding(3) var<storage, read_write> counters: array<atomic<u32>>;

struct Uniforms {
  dimensions: vec3<u32>,
  previewMode: u32,
  maxOutputFaces: u32,
  blockFaceAtlasSize: u32,
}

@group(1) @binding(0) var<uniform> uniforms: Uniforms;

const DIRECTION_COUNT: u32 = 6u;
const FACE_DATA_SIZE: u32 = 5u;

const directions = array<vec3<i32>, 6>(
  vec3<i32>(1, 0, 0),   // +X
  vec3<i32>(-1, 0, 0),  // -X
  vec3<i32>(0, 1, 0),   // +Y
  vec3<i32>(0, -1, 0),  // -Y
  vec3<i32>(0, 0, 1),   // +Z
  vec3<i32>(0, 0, -1)   // -Z
);

fn getBlockIndex(pos: vec3<u32>) -> u32 {
  return pos.x * uniforms.dimensions.y * uniforms.dimensions.z + pos.y * uniforms.dimensions.z + pos.z;
}

fn getPackedBlocks(pos: vec3<u32>) -> vec2<u32> {
  if (pos.x >= uniforms.dimensions.x || pos.y >= uniforms.dimensions.y || pos.z >= uniforms.dimensions.z) {
    return vec2<u32>(0u, 0u);
  }
  let index = getBlockIndex(pos);
  let packed = blockData[index];
  return vec2<u32>(packed & 0xFFFFu, (packed >> 16u) & 0xFFFFu);
}

fn getBlockFaceTexture(blockType: u32, faceDirection: u32) -> u32 {
  if (blockType == 0u) { return 0u; }
  let atlasIndex = (blockType - 1u) * DIRECTION_COUNT + faceDirection;
  if (atlasIndex >= uniforms.blockFaceAtlasSize) { return 0u; }
  return blockFaceAtlas[atlasIndex];
}

fn shouldShowFace(currentPos: vec3<u32>, faceDir: u32, currentReal: u32, currentPreview: u32) -> bool {
  let neighborPos = vec3<i32>(currentPos) + directions[faceDir];
  
  if (neighborPos.x < 0 || neighborPos.y < 0 || neighborPos.z < 0) {
    return true;
  }
  
  let nPos = vec3<u32>(neighborPos);
  let neighborBlocks = getPackedBlocks(nPos);
  let neighborReal = neighborBlocks.x;
  let neighborPreview = neighborBlocks.y;
  
  let neighborHasReal = neighborReal != 0u;
  let neighborHasPreview = neighborPreview != 0u;
  
  if (!neighborHasReal) {
    return true;
  }
  
  if (uniforms.previewMode == 1u && neighborHasPreview) {
    return true;
  }
  
  if (uniforms.previewMode == 3u && neighborHasPreview && !neighborHasReal) {
    return true;
  }
  
  return false;
}

fn addFace(pos: vec3<u32>, textureIndex: u32, faceDir: u32, isPreview: bool) {
  var index: u32;
  if (isPreview) {
    index = atomicAdd(&counters[1], 1u);
    index += uniforms.maxOutputFaces / 2u;
  } else {
    index = atomicAdd(&counters[0], 1u);
  }
  
  if (index >= uniforms.maxOutputFaces) {
    return;
  }
  
  let baseIndex = index * FACE_DATA_SIZE;
  outputFaces[baseIndex + 0u] = pos.x;
  outputFaces[baseIndex + 1u] = pos.y;
  outputFaces[baseIndex + 2u] = pos.z;
  outputFaces[baseIndex + 3u] = textureIndex;
  outputFaces[baseIndex + 4u] = faceDir;
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let totalVoxels = uniforms.dimensions.x * uniforms.dimensions.y * uniforms.dimensions.z;
  let index = global_id.x;
  
  if (index >= totalVoxels) {
    return;
  }
  
  let z = index % uniforms.dimensions.z;
  let y = (index / uniforms.dimensions.z) % uniforms.dimensions.y;
  let x = index / (uniforms.dimensions.y * uniforms.dimensions.z);
  let pos = vec3<u32>(x, y, z);
  
  let blocks = getPackedBlocks(pos);
  let realBlock = blocks.x;
  let previewBlock = blocks.y;
  
  let hasReal = realBlock != 0u;
  let hasPreview = previewBlock != 0u;
  let isBuildMode = uniforms.previewMode == 2u;
  let isPaintMode = uniforms.previewMode == 3u;
  
  if (hasReal && (isBuildMode || !hasPreview)) {
    for (var faceDir: u32 = 0u; faceDir < DIRECTION_COUNT; faceDir++) {
      if (shouldShowFace(pos, faceDir, realBlock, previewBlock)) {
        let textureIndex = getBlockFaceTexture(realBlock, faceDir);
        addFace(pos, textureIndex, faceDir, false);
      }
    }
  }
  
  if (hasPreview) {
    if (isPaintMode && !hasReal) {
      return;
    }
    
    for (var faceDir: u32 = 0u; faceDir < DIRECTION_COUNT; faceDir++) {
      if (shouldShowFace(pos, faceDir, realBlock, previewBlock)) {
        let textureIndex = getBlockFaceTexture(previewBlock, faceDir);
        addFace(pos, textureIndex, faceDir, true);
      }
    }
  }
}
`;

interface BufferPool {
    blockDataBuffer?: GPUBuffer;
    blockFaceAtlasBuffer?: GPUBuffer;
    outputBuffer?: GPUBuffer;
    counterBuffer?: GPUBuffer;
    uniformsBuffer?: GPUBuffer;
    readCounterBuffer?: GPUBuffer;
    readOutputBuffer?: GPUBuffer;
    currentCapacity: number;
}

export class WebGPUFaceFinder {
    private device: GPUDevice;
    private bindGroupLayout: GPUBindGroupLayout;
    private uniformsBindGroupLayout: GPUBindGroupLayout;
    private computePipeline: GPUComputePipeline;
    private bufferPool: BufferPool;
    private pendingOperations: Promise<any>[] = [];
    private buffersMapped = false;

    constructor(device: GPUDevice) {
        this.device = device;
        this.bindGroupLayout = this.createBindGroupLayout();
        this.uniformsBindGroupLayout = this.createUniformsBindGroupLayout();
        this.computePipeline = this.createComputePipeline();
        this.bufferPool = { currentCapacity: 0 };
    }

    private createBindGroupLayout(): GPUBindGroupLayout {
        return this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });
    }

    private createUniformsBindGroupLayout(): GPUBindGroupLayout {
        return this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });
    }

    private createComputePipeline(): GPUComputePipeline {
        const shaderModule = this.device.createShaderModule({ code: COMPUTE_SHADER_SOURCE });

        return this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout, this.uniformsBindGroupLayout],
            }),
            compute: { module: shaderModule, entryPoint: 'main' },
        });
    }

    private packBlocks(
        realBlocks: (Block | undefined)[][][],
        previewBlocks: (Block | undefined)[][][],
        dimensions: { xDim: number; yDim: number; zDim: number }
    ): Uint32Array {
        const { xDim, yDim, zDim } = dimensions;
        const packed = new Uint32Array(xDim * yDim * zDim);

        for (let x = 0; x < xDim; x++) {
            for (let y = 0; y < yDim; y++) {
                for (let z = 0; z < zDim; z++) {
                    const index = x * yDim * zDim + y * zDim + z;
                    const realBlock = realBlocks[x]?.[y]?.[z];
                    const previewBlock = previewBlocks[x]?.[y]?.[z];

                    const realType = realBlock ? realBlock.type : 0;
                    const previewType = previewBlock ? previewBlock.type : 0;

                    packed[index] = (realType & 0xFFFF) | ((previewType & 0xFFFF) << 16);
                }
            }
        }

        return packed;
    }

    private flattenBlockFaceAtlas(blocks: ProjectBlocks): Uint32Array {
        const flattened: number[] = [];
        for (const blockFaces of blocks.blockFaceAtlasIndexes) {
            flattened.push(...blockFaces);
        }
        return new Uint32Array(flattened);
    }

    private getPreviewModeValue(previewMode: BlockModificationMode): number {
        if (previewMode.tag === 'Erase') return 1;
        if (previewMode.tag === 'Build') return 2;
        if (previewMode.tag === 'Paint') return 3;
        return 0;
    }

    private ensureBuffersUnmapped(): void {
        if (this.buffersMapped) {
            try {
                this.bufferPool.readCounterBuffer?.unmap();
                this.bufferPool.readOutputBuffer?.unmap();
            } catch (e) {
                // Buffers might already be unmapped, ignore error
            }
            this.buffersMapped = false;
        }
    }

    private ensureBufferCapacity(requiredVoxels: number, blockFaceAtlasSize: number): void {
        const maxOutputFaces = Math.min(requiredVoxels * 6 * 2, 2000000);

        if (this.bufferPool.currentCapacity >= requiredVoxels) {
            return;
        }

        this.ensureBuffersUnmapped();

        this.bufferPool.blockDataBuffer?.destroy();
        this.bufferPool.blockFaceAtlasBuffer?.destroy();
        this.bufferPool.outputBuffer?.destroy();
        this.bufferPool.counterBuffer?.destroy();
        this.bufferPool.uniformsBuffer?.destroy();
        this.bufferPool.readCounterBuffer?.destroy();
        this.bufferPool.readOutputBuffer?.destroy();

        this.bufferPool.blockDataBuffer = this.device.createBuffer({
            size: requiredVoxels * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.bufferPool.blockFaceAtlasBuffer = this.device.createBuffer({
            size: blockFaceAtlasSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.bufferPool.outputBuffer = this.device.createBuffer({
            size: maxOutputFaces * 5 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.bufferPool.counterBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        this.bufferPool.uniformsBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bufferPool.readCounterBuffer = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        this.bufferPool.readOutputBuffer = this.device.createBuffer({
            size: maxOutputFaces * 5 * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        this.bufferPool.currentCapacity = requiredVoxels;
    }

    async findExteriorFaces(
        realBlocks: (Block | undefined)[][][],
        previewBlocks: (Block | undefined)[][][],
        previewMode: BlockModificationMode,
        atlas: Atlas,
        blocks: ProjectBlocks,
        dimensions: { xDim: number; yDim: number; zDim: number }
    ): Promise<{ meshFaces: Map<string, VoxelFaces>; previewFaces: Map<string, VoxelFaces> }> {
        const start = performance.now();
        const { xDim, yDim, zDim } = dimensions;
        const totalVoxels = xDim * yDim * zDim;

        await Promise.all(this.pendingOperations);
        this.pendingOperations = [];

        // Ensure buffers are unmapped before proceeding
        this.ensureBuffersUnmapped();

        const packedBlocksData = this.packBlocks(realBlocks, previewBlocks, dimensions);
        const blockFaceAtlasData = this.flattenBlockFaceAtlas(blocks);
        const maxOutputFaces = Math.min(totalVoxels * 6 * 2, 2000000);

        this.ensureBufferCapacity(totalVoxels, blockFaceAtlasData.length);

        const uniformsData = new Uint32Array([
            xDim, yDim, zDim,
            this.getPreviewModeValue(previewMode),
            maxOutputFaces,
            blockFaceAtlasData.length,
            0, 0
        ]);

        this.device.queue.writeBuffer(this.bufferPool.blockDataBuffer!, 0, packedBlocksData);
        this.device.queue.writeBuffer(this.bufferPool.blockFaceAtlasBuffer!, 0, blockFaceAtlasData);
        this.device.queue.writeBuffer(this.bufferPool.uniformsBuffer!, 0, uniformsData);

        const clearCounters = new Uint32Array([0, 0]);
        this.device.queue.writeBuffer(this.bufferPool.counterBuffer!, 0, clearCounters);

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.bufferPool.blockDataBuffer! } },
                { binding: 1, resource: { buffer: this.bufferPool.blockFaceAtlasBuffer! } },
                { binding: 2, resource: { buffer: this.bufferPool.outputBuffer! } },
                { binding: 3, resource: { buffer: this.bufferPool.counterBuffer! } },
            ],
        });

        const uniformsBindGroup = this.device.createBindGroup({
            layout: this.uniformsBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.bufferPool.uniformsBuffer! } },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();

        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, bindGroup);
        computePass.setBindGroup(1, uniformsBindGroup);

        const workGroups = Math.ceil(totalVoxels / 64);
        computePass.dispatchWorkgroups(workGroups, 1, 1);
        computePass.end();

        commandEncoder.copyBufferToBuffer(
            this.bufferPool.counterBuffer!, 0,
            this.bufferPool.readCounterBuffer!, 0, 8
        );
        commandEncoder.copyBufferToBuffer(
            this.bufferPool.outputBuffer!, 0,
            this.bufferPool.readOutputBuffer!, 0, maxOutputFaces * 5 * 4
        );

        this.device.queue.submit([commandEncoder.finish()]);

        try {
            const mapPromise = Promise.all([
                this.bufferPool.readCounterBuffer!.mapAsync(GPUMapMode.READ),
                this.bufferPool.readOutputBuffer!.mapAsync(GPUMapMode.READ)
            ]);

            this.pendingOperations.push(mapPromise);
            await mapPromise;
            this.buffersMapped = true;
        } catch (error) {
            throw new Error(`Failed to map GPU buffers: ${error}`);
        }

        const counterResult = new Uint32Array(this.bufferPool.readCounterBuffer!.getMappedRange());
        const outputResult = new Uint32Array(this.bufferPool.readOutputBuffer!.getMappedRange());

        const realFaceCount = counterResult[0];
        const previewFaceCount = counterResult[1];

        const meshFaces = new Map<string, VoxelFaces>();
        const previewFaces = new Map<string, VoxelFaces>();

        for (let i = 0; i < realFaceCount; i++) {
            const baseIndex = i * 5;
            const x = outputResult[baseIndex];
            const y = outputResult[baseIndex + 1];
            const z = outputResult[baseIndex + 2];
            const textureIndex = outputResult[baseIndex + 3];
            const faceDirection = outputResult[baseIndex + 4];

            const key = `${x},${y},${z},${textureIndex}`;

            if (!meshFaces.has(key)) {
                meshFaces.set(key, {
                    textureIndex,
                    faceIndexes: [],
                    gridPos: new THREE.Vector3(x, y, z),
                });
            }

            meshFaces.get(key)!.faceIndexes.push(faceDirection);
        }

        const previewStartIndex = maxOutputFaces / 2;
        for (let i = 0; i < previewFaceCount; i++) {
            const baseIndex = (previewStartIndex + i) * 5;
            const x = outputResult[baseIndex];
            const y = outputResult[baseIndex + 1];
            const z = outputResult[baseIndex + 2];
            const textureIndex = outputResult[baseIndex + 3];
            const faceDirection = outputResult[baseIndex + 4];

            const key = `${x},${y},${z},${textureIndex}`;

            if (!previewFaces.has(key)) {
                previewFaces.set(key, {
                    textureIndex,
                    faceIndexes: [],
                    gridPos: new THREE.Vector3(x, y, z),
                });
            }

            previewFaces.get(key)!.faceIndexes.push(faceDirection);
        }

        try {
            this.bufferPool.readCounterBuffer!.unmap();
            this.bufferPool.readOutputBuffer!.unmap();
        } catch (e) {
            // Buffers might already be unmapped
        }
        this.buffersMapped = false;

        const totalTime = performance.now() - start;

        console.log('[WebGPUFaceFinder] GPU compute profile:', {
            totalTime: totalTime.toFixed(2) + 'ms',
            dimensions: `${xDim}x${yDim}x${zDim}`,
            facesGenerated: meshFaces.size + previewFaces.size,
            realFaces: realFaceCount,
            previewFaces: previewFaceCount,
            workGroups: workGroups,
        });

        return { meshFaces, previewFaces };
    }

    dispose(): void {
        this.ensureBuffersUnmapped();

        this.bufferPool.blockDataBuffer?.destroy();
        this.bufferPool.blockFaceAtlasBuffer?.destroy();
        this.bufferPool.outputBuffer?.destroy();
        this.bufferPool.counterBuffer?.destroy();
        this.bufferPool.uniformsBuffer?.destroy();
        this.bufferPool.readCounterBuffer?.destroy();
        this.bufferPool.readOutputBuffer?.destroy();
    }
}

export const createWebGPUFaceFinder = async (): Promise<WebGPUFaceFinder> => {
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('No WebGPU adapter found');
    }

    const device = await adapter.requestDevice();
    return new WebGPUFaceFinder(device);
};