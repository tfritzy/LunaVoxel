import type { Vector3 } from "@/state/types";
import { FACE_TANGENTS_FLAT } from "./ambient-occlusion";

const WORKGROUP_SIZE = 64;

const FACE_SHADER = /* wgsl */ `
struct Params {
  dimX: u32,
  dimY: u32,
  dimZ: u32,
  totalVoxels: u32,
  selectionEmpty: u32,
}

@group(0) @binding(0) var<storage, read> voxelData: array<u32>;
@group(0) @binding(1) var<storage, read> selectionData: array<u32>;
@group(0) @binding(2) var<storage, read> blockAtlasMapping: array<u32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read> faceTangents: array<i32>;
// Output: per voxel, 6 faces, each face stores: [faceActive, textureIndex, aoValue, isSelected]
@group(0) @binding(5) var<storage, read_write> faceOutput: array<u32>;

fn getBlockType(val: u32) -> u32 {
  return val & 0x7Fu;
}

fn isBlockVisible(val: u32) -> bool {
  let bt = val & 0x7Fu;
  return bt != 0u;
}

fn readVoxel(index: u32) -> u32 {
  let wordIndex = index / 4u;
  let byteOffset = index % 4u;
  return (voxelData[wordIndex] >> (byteOffset * 8u)) & 0xFFu;
}

fn readSelection(index: u32) -> u32 {
  let wordIndex = index / 4u;
  let byteOffset = index % 4u;
  return (selectionData[wordIndex] >> (byteOffset * 8u)) & 0xFFu;
}

fn voxelIndex(x: u32, y: u32, z: u32) -> u32 {
  return x * params.dimY * params.dimZ + y * params.dimZ + z;
}

fn isOccluder(x: i32, y: i32, z: i32) -> bool {
  if (x < 0 || x >= i32(params.dimX) || y < 0 || y >= i32(params.dimY) || z < 0 || z >= i32(params.dimZ)) {
    return false;
  }
  let idx = voxelIndex(u32(x), u32(y), u32(z));
  let val = readVoxel(idx);
  return (val & 0x7Fu) != 0u;
}

fn calculateAO(nx: i32, ny: i32, nz: i32, faceDir: u32) -> u32 {
  let offset = faceDir * 6u;
  let u0 = faceTangents[offset];
  let u1 = faceTangents[offset + 1u];
  let u2 = faceTangents[offset + 2u];
  let v0 = faceTangents[offset + 3u];
  let v1 = faceTangents[offset + 4u];
  let v2 = faceTangents[offset + 5u];

  let s1n = isOccluder(nx - u0, ny - u1, nz - u2);
  let s1p = isOccluder(nx + u0, ny + u1, nz + u2);
  let s2n = isOccluder(nx - v0, ny - v1, nz - v2);
  let s2p = isOccluder(nx + v0, ny + v1, nz + v2);

  let cnn = isOccluder(nx - u0 - v0, ny - u1 - v1, nz - u2 - v2);
  let cpn = isOccluder(nx + u0 - v0, ny + u1 - v1, nz + u2 - v2);
  let cnp = isOccluder(nx - u0 + v0, ny - u1 + v1, nz - u2 + v2);
  let cpp = isOccluder(nx + u0 + v0, ny + u1 + v1, nz + u2 + v2);

  var occ00: u32;
  if (s1n && s2n) { occ00 = 3u; } else { occ00 = select(0u, 1u, s1n) + select(0u, 1u, s2n) + select(0u, 1u, cnn); }
  var occ10: u32;
  if (s1p && s2n) { occ10 = 3u; } else { occ10 = select(0u, 1u, s1p) + select(0u, 1u, s2n) + select(0u, 1u, cpn); }
  var occ11: u32;
  if (s1p && s2p) { occ11 = 3u; } else { occ11 = select(0u, 1u, s1p) + select(0u, 1u, s2p) + select(0u, 1u, cpp); }
  var occ01: u32;
  if (s1n && s2p) { occ01 = 3u; } else { occ01 = select(0u, 1u, s1n) + select(0u, 1u, s2p) + select(0u, 1u, cnp); }

  return occ00 | (occ10 << 2u) | (occ11 << 4u) | (occ01 << 6u);
}

const FACE_DIRS = array<vec3<i32>, 6>(
  vec3<i32>(1, 0, 0),
  vec3<i32>(-1, 0, 0),
  vec3<i32>(0, 1, 0),
  vec3<i32>(0, -1, 0),
  vec3<i32>(0, 0, 1),
  vec3<i32>(0, 0, -1),
);

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let voxelIdx = gid.x;
  if (voxelIdx >= params.totalVoxels) {
    return;
  }

  let strideYZ = params.dimY * params.dimZ;
  let x = voxelIdx / strideYZ;
  let remainder = voxelIdx % strideYZ;
  let y = remainder / params.dimZ;
  let z = remainder % params.dimZ;

  let blockValue = readVoxel(voxelIdx);
  let blockType = getBlockType(blockValue);
  let blockVis = isBlockVisible(blockValue);
  let selEmpty = params.selectionEmpty != 0u;

  var blockIsSelected = false;
  var selectionVal = 0u;
  if (!selEmpty) {
    selectionVal = readSelection(voxelIdx);
    blockIsSelected = selectionVal != 0u;
  }

  let outputBase = voxelIdx * 6u;

  if (!blockVis && !blockIsSelected) {
    for (var f = 0u; f < 6u; f++) {
      let outIdx = (outputBase + f) * 4u;
      faceOutput[outIdx] = 0u;
      faceOutput[outIdx + 1u] = 0u;
      faceOutput[outIdx + 2u] = 0u;
      faceOutput[outIdx + 3u] = 0u;
    }
    return;
  }

  let ix = i32(x);
  let iy = i32(y);
  let iz = i32(z);

  for (var f = 0u; f < 6u; f++) {
    let dir = FACE_DIRS[f];
    let nx = ix + dir.x;
    let ny = iy + dir.y;
    let nz = iz + dir.z;

    let outIdx = (outputBase + f) * 4u;

    let neighborInBounds = nx >= 0 && nx < i32(params.dimX)
                        && ny >= 0 && ny < i32(params.dimY)
                        && nz >= 0 && nz < i32(params.dimZ);

    if (blockIsSelected && !blockVis) {
      let neighborIsSelected = neighborInBounds && readSelection(voxelIndex(u32(nx), u32(ny), u32(nz))) != 0u;

      if (!neighborIsSelected) {
        let selBlockType = selectionVal & 0x7Fu;
        let texIdx = blockAtlasMapping[max(selBlockType, 1u) - 1u];
        let ao = calculateAO(nx, ny, nz, f);

        faceOutput[outIdx] = 1u;
        faceOutput[outIdx + 1u] = texIdx;
        faceOutput[outIdx + 2u] = ao;
        faceOutput[outIdx + 3u] = 1u;
      } else {
        faceOutput[outIdx] = 0u;
        faceOutput[outIdx + 1u] = 0u;
        faceOutput[outIdx + 2u] = 0u;
        faceOutput[outIdx + 3u] = 0u;
      }
    } else if (blockVis) {
      let neighborVis = neighborInBounds && isBlockVisible(readVoxel(voxelIndex(u32(nx), u32(ny), u32(nz))));

      if (!neighborVis) {
        let texIdx = blockAtlasMapping[blockType - 1u];
        let ao = calculateAO(nx, ny, nz, f);

        faceOutput[outIdx] = 1u;
        faceOutput[outIdx + 1u] = texIdx;
        faceOutput[outIdx + 2u] = ao;
        faceOutput[outIdx + 3u] = select(0u, 1u, blockIsSelected);
      } else {
        faceOutput[outIdx] = 0u;
        faceOutput[outIdx + 1u] = 0u;
        faceOutput[outIdx + 2u] = 0u;
        faceOutput[outIdx + 3u] = 0u;
      }
    } else {
      faceOutput[outIdx] = 0u;
      faceOutput[outIdx + 1u] = 0u;
      faceOutput[outIdx + 2u] = 0u;
      faceOutput[outIdx + 3u] = 0u;
    }
  }
}
`;

export class GPUFaceFinder {
  private device: GPUDevice;
  private pipeline: GPUComputePipeline | null = null;
  private paramsBuffer: GPUBuffer | null = null;
  private tangentsBuffer: GPUBuffer | null = null;

  private cachedVoxelBuffer: GPUBuffer | null = null;
  private cachedSelectionBuffer: GPUBuffer | null = null;
  private cachedMappingBuffer: GPUBuffer | null = null;
  private cachedOutputBuffer: GPUBuffer | null = null;
  private cachedReadBuffer: GPUBuffer | null = null;
  private cachedTotalVoxels: number = 0;
  private cachedMappingLength: number = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  private ensurePipeline(): GPUComputePipeline {
    if (this.pipeline) return this.pipeline;

    const shaderModule = this.device.createShaderModule({
      code: FACE_SHADER,
    });

    this.pipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });

    const tangentsData = new Int32Array(FACE_TANGENTS_FLAT);
    this.tangentsBuffer = this.device.createBuffer({
      size: tangentsData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.tangentsBuffer, 0, tangentsData);

    this.paramsBuffer = this.device.createBuffer({
      size: 5 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    return this.pipeline;
  }

  private ensureBuffers(totalVoxels: number, mappingLength: number): void {
    const voxelByteSize = Math.ceil(totalVoxels / 4) * 4;
    const outputSize = totalVoxels * 6 * 4 * 4;

    if (totalVoxels !== this.cachedTotalVoxels) {
      this.cachedVoxelBuffer?.destroy();
      this.cachedSelectionBuffer?.destroy();
      this.cachedOutputBuffer?.destroy();
      this.cachedReadBuffer?.destroy();

      this.cachedVoxelBuffer = this.device.createBuffer({
        size: voxelByteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.cachedSelectionBuffer = this.device.createBuffer({
        size: voxelByteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.cachedOutputBuffer = this.device.createBuffer({
        size: outputSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });

      this.cachedReadBuffer = this.device.createBuffer({
        size: outputSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      this.cachedTotalVoxels = totalVoxels;
    }

    if (mappingLength !== this.cachedMappingLength) {
      this.cachedMappingBuffer?.destroy();
      this.cachedMappingBuffer = this.device.createBuffer({
        size: mappingLength * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.cachedMappingLength = mappingLength;
    }
  }

  async computeFaceData(
    voxelData: Uint8Array,
    selectionData: Uint8Array,
    selectionEmpty: boolean,
    blockAtlasMapping: number[],
    dimensions: Vector3
  ): Promise<Uint32Array> {
    const pipeline = this.ensurePipeline();
    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    this.ensureBuffers(totalVoxels, blockAtlasMapping.length);

    const voxelBuffer = this.cachedVoxelBuffer!;
    const selectionBuffer = this.cachedSelectionBuffer!;
    const mappingBuffer = this.cachedMappingBuffer!;
    const outputBuffer = this.cachedOutputBuffer!;
    const readBuffer = this.cachedReadBuffer!;

    this.device.queue.writeBuffer(voxelBuffer, 0, voxelData);
    this.device.queue.writeBuffer(selectionBuffer, 0, selectionData);
    this.device.queue.writeBuffer(
      mappingBuffer,
      0,
      new Uint32Array(blockAtlasMapping)
    );
    this.device.queue.writeBuffer(
      this.paramsBuffer!,
      0,
      new Uint32Array([
        dimensions.x,
        dimensions.y,
        dimensions.z,
        totalVoxels,
        selectionEmpty ? 1 : 0,
      ])
    );

    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: voxelBuffer } },
        { binding: 1, resource: { buffer: selectionBuffer } },
        { binding: 2, resource: { buffer: mappingBuffer } },
        { binding: 3, resource: { buffer: this.paramsBuffer! } },
        { binding: 4, resource: { buffer: this.tangentsBuffer! } },
        { binding: 5, resource: { buffer: outputBuffer } },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(totalVoxels / WORKGROUP_SIZE));
    pass.end();

    const outputSize = totalVoxels * 6 * 4 * 4;
    encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputSize);
    this.device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    return result;
  }

  destroy(): void {
    this.cachedVoxelBuffer?.destroy();
    this.cachedSelectionBuffer?.destroy();
    this.cachedMappingBuffer?.destroy();
    this.cachedOutputBuffer?.destroy();
    this.cachedReadBuffer?.destroy();
    this.tangentsBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.cachedVoxelBuffer = null;
    this.cachedSelectionBuffer = null;
    this.cachedMappingBuffer = null;
    this.cachedOutputBuffer = null;
    this.cachedReadBuffer = null;
    this.tangentsBuffer = null;
    this.paramsBuffer = null;
    this.pipeline = null;
  }
}
