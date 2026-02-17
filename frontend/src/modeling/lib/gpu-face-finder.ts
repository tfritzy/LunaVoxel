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

const MESH_SHADER = /* wgsl */ `
struct MeshParams {
  dimX: u32,
  dimY: u32,
  dimZ: u32,
  totalSlices: u32,
  textureWidth: u32,
  maxDim: u32,
}

const OCCLUSION_LEVELS = array<f32, 4>(1.0, 0.9, 0.85, 0.75);

const FACE_NORMALS = array<vec3<f32>, 6>(
  vec3<f32>(1.0, 0.0, 0.0),
  vec3<f32>(-1.0, 0.0, 0.0),
  vec3<f32>(0.0, 1.0, 0.0),
  vec3<f32>(0.0, -1.0, 0.0),
  vec3<f32>(0.0, 0.0, 1.0),
  vec3<f32>(0.0, 0.0, -1.0),
);

@group(0) @binding(0) var<storage, read_write> faceData: array<u32>;
@group(0) @binding(1) var<uniform> meshParams: MeshParams;
@group(0) @binding(2) var<storage, read_write> counters: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> vertices: array<f32>;
@group(0) @binding(4) var<storage, read_write> normals: array<f32>;
@group(0) @binding(5) var<storage, read_write> uvs: array<f32>;
@group(0) @binding(6) var<storage, read_write> ao: array<f32>;
@group(0) @binding(7) var<storage, read_write> isSelectedOut: array<f32>;
@group(0) @binding(8) var<storage, read_write> indices: array<u32>;

fn getDimForAxis(a: u32) -> u32 {
  if (a == 0u) { return meshParams.dimX; }
  if (a == 1u) { return meshParams.dimY; }
  return meshParams.dimZ;
}

fn getTextureUV(textureIndex: u32) -> vec2<f32> {
  let tw = f32(meshParams.textureWidth);
  let textureSize = 1.0 / tw;
  let halfPixel = textureSize * 0.5;
  let col = f32(textureIndex % meshParams.textureWidth);
  let row = f32(textureIndex / meshParams.textureWidth);
  let u = col * textureSize + halfPixel;
  let v = 1.0 - (row * textureSize + halfPixel);
  return vec2<f32>(u, v);
}

fn emitQuad(
  axis: u32, u_ax: u32, v_ax: u32,
  depth: u32, i_pos: u32, j_pos: u32,
  quadWidth: u32, quadHeight: u32,
  dir: i32, faceDir: u32,
  textureIndex: u32, aoVal: u32, isSelected: u32,
) {
  let vertexBase = atomicAdd(&counters[0], 4u);
  let indexBase = atomicAdd(&counters[1], 6u);

  let normal = FACE_NORMALS[faceDir];
  let uv = getTextureUV(textureIndex);
  let faceOffset = select(0u, 1u, dir > 0);
  let selF = f32(isSelected);

  for (var vi = 0u; vi < 4u; vi++) {
    var actualVi = vi;
    if (dir < 0 && (vi == 1u || vi == 3u)) {
      actualVi = select(1u, 3u, vi == 1u);
    }

    var pos = array<f32, 3>(0.0, 0.0, 0.0);
    pos[axis] = f32(depth + faceOffset);

    if (actualVi == 0u) {
      pos[u_ax] = f32(i_pos);
      pos[v_ax] = f32(j_pos);
    } else if (actualVi == 1u) {
      pos[u_ax] = f32(i_pos + quadWidth);
      pos[v_ax] = f32(j_pos);
    } else if (actualVi == 2u) {
      pos[u_ax] = f32(i_pos + quadWidth);
      pos[v_ax] = f32(j_pos + quadHeight);
    } else {
      pos[u_ax] = f32(i_pos);
      pos[v_ax] = f32(j_pos + quadHeight);
    }

    let vIdx = vertexBase + vi;
    vertices[vIdx * 3u] = pos[0];
    vertices[vIdx * 3u + 1u] = pos[1];
    vertices[vIdx * 3u + 2u] = pos[2];

    normals[vIdx * 3u] = normal.x;
    normals[vIdx * 3u + 1u] = normal.y;
    normals[vIdx * 3u + 2u] = normal.z;

    uvs[vIdx * 2u] = uv.x;
    uvs[vIdx * 2u + 1u] = uv.y;

    var aoCornerIndex = vi;
    if (faceDir == 1u || faceDir == 2u || faceDir == 5u) {
      if (vi == 1u) { aoCornerIndex = 3u; }
      else if (vi == 3u) { aoCornerIndex = 1u; }
    }
    let occCount = (aoVal >> (aoCornerIndex * 2u)) & 0x03u;
    ao[vIdx] = OCCLUSION_LEVELS[occCount];
    isSelectedOut[vIdx] = selF;
  }

  indices[indexBase] = vertexBase;
  indices[indexBase + 1u] = vertexBase + 1u;
  indices[indexBase + 2u] = vertexBase + 2u;
  indices[indexBase + 3u] = vertexBase;
  indices[indexBase + 4u] = vertexBase + 2u;
  indices[indexBase + 5u] = vertexBase + 3u;
}

fn getFaceData(x: u32, y: u32, z: u32, faceDir: u32) -> vec4<u32> {
  let voxelIdx = x * meshParams.dimY * meshParams.dimZ + y * meshParams.dimZ + z;
  let base = (voxelIdx * 6u + faceDir) * 4u;
  return vec4<u32>(faceData[base], faceData[base + 1u], faceData[base + 2u], faceData[base + 3u]);
}

fn clearFace(x: u32, y: u32, z: u32, faceDir: u32) {
  let voxelIdx = x * meshParams.dimY * meshParams.dimZ + y * meshParams.dimZ + z;
  let base = (voxelIdx * 6u + faceDir) * 4u;
  faceData[base] = 0u;
}

fn getCoord(axis: u32, u_ax: u32, depth: u32, iu: u32, iv: u32) -> vec3<u32> {
  var c = vec3<u32>(0u, 0u, 0u);
  c[axis] = depth;
  c[u_ax] = iu;
  c[(axis + 2u) % 3u] = iv;
  return c;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let sliceIdx = gid.x;
  if (sliceIdx >= meshParams.totalSlices) {
    return;
  }

  var axis: u32;
  var dirIdx: u32;
  var depth: u32;
  var remaining = sliceIdx;

  let slicesAxis0 = getDimForAxis(0u) * 2u;
  let slicesAxis1 = getDimForAxis(1u) * 2u;

  if (remaining < slicesAxis0) {
    axis = 0u;
    dirIdx = remaining / getDimForAxis(0u);
    depth = remaining % getDimForAxis(0u);
  } else if (remaining < slicesAxis0 + slicesAxis1) {
    remaining -= slicesAxis0;
    axis = 1u;
    dirIdx = remaining / getDimForAxis(1u);
    depth = remaining % getDimForAxis(1u);
  } else {
    remaining -= slicesAxis0 + slicesAxis1;
    axis = 2u;
    dirIdx = remaining / getDimForAxis(2u);
    depth = remaining % getDimForAxis(2u);
  }

  let u_ax = (axis + 1u) % 3u;
  let v_ax = (axis + 2u) % 3u;
  let uSize = getDimForAxis(u_ax);
  let vSize = getDimForAxis(v_ax);
  let faceDir = axis * 2u + select(1u, 0u, dirIdx == 0u);
  let dir = select(-1, 1, dirIdx == 0u);

  for (var iv = 0u; iv < vSize; iv++) {
    var iu = 0u;
    loop {
      if (iu >= uSize) { break; }

      let c = getCoord(axis, u_ax, depth, iu, iv);
      let fd = getFaceData(c.x, c.y, c.z, faceDir);
      if (fd.x == 0u) {
        iu++;
        continue;
      }

      let textureIndex = fd.y;
      let aoVal = fd.z;
      let isSelected = fd.w;

      var quadWidth = 1u;
      for (var w = iu + 1u; w < uSize; w++) {
        let wc = getCoord(axis, u_ax, depth, w, iv);
        let wfd = getFaceData(wc.x, wc.y, wc.z, faceDir);
        if (wfd.x == 0u || wfd.y != textureIndex || wfd.z != aoVal || wfd.w != isSelected) {
          break;
        }
        quadWidth++;
      }

      var quadHeight = 1u;
      for (var h = iv + 1u; h < vSize; h++) {
        var rowOk = true;
        for (var w = 0u; w < quadWidth; w++) {
          let hc = getCoord(axis, u_ax, depth, iu + w, h);
          let hfd = getFaceData(hc.x, hc.y, hc.z, faceDir);
          if (hfd.x == 0u || hfd.y != textureIndex || hfd.z != aoVal || hfd.w != isSelected) {
            rowOk = false;
            break;
          }
        }
        if (!rowOk) { break; }
        quadHeight++;
      }

      for (var cj = iv; cj < iv + quadHeight; cj++) {
        for (var ci = iu; ci < iu + quadWidth; ci++) {
          let cc = getCoord(axis, u_ax, depth, ci, cj);
          clearFace(cc.x, cc.y, cc.z, faceDir);
        }
      }

      emitQuad(axis, u_ax, v_ax, depth, iu, iv, quadWidth, quadHeight, dir, faceDir, textureIndex, aoVal, isSelected);

      iu += quadWidth;
    }
  }
}
`;

export interface GPUMeshResult {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  ao: Float32Array;
  isSelected: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  indexCount: number;
}

export class GPUFaceFinder {
  private device: GPUDevice;
  private facePipeline: GPUComputePipeline | null = null;
  private meshPipeline: GPUComputePipeline | null = null;
  private paramsBuffer: GPUBuffer | null = null;
  private tangentsBuffer: GPUBuffer | null = null;
  private meshParamsBuffer: GPUBuffer | null = null;

  private cachedVoxelBuffer: GPUBuffer | null = null;
  private cachedSelectionBuffer: GPUBuffer | null = null;
  private cachedMappingBuffer: GPUBuffer | null = null;
  private cachedFaceBuffer: GPUBuffer | null = null;
  private cachedTotalVoxels: number = 0;
  private cachedMappingLength: number = 0;

  private cachedCounterBuffer: GPUBuffer | null = null;
  private cachedCounterReadBuffer: GPUBuffer | null = null;
  private cachedVertexBuffer: GPUBuffer | null = null;
  private cachedNormalBuffer: GPUBuffer | null = null;
  private cachedUVBuffer: GPUBuffer | null = null;
  private cachedAOBuffer: GPUBuffer | null = null;
  private cachedIsSelectedBuffer: GPUBuffer | null = null;
  private cachedIndexBuffer: GPUBuffer | null = null;
  private cachedVertexReadBuffer: GPUBuffer | null = null;
  private cachedNormalReadBuffer: GPUBuffer | null = null;
  private cachedUVReadBuffer: GPUBuffer | null = null;
  private cachedAOReadBuffer: GPUBuffer | null = null;
  private cachedIsSelectedReadBuffer: GPUBuffer | null = null;
  private cachedIndexReadBuffer: GPUBuffer | null = null;
  private cachedMaxFaces: number = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  private ensureFacePipeline(): GPUComputePipeline {
    if (this.facePipeline) return this.facePipeline;

    const shaderModule = this.device.createShaderModule({
      code: FACE_SHADER,
    });

    shaderModule.getCompilationInfo().then((info) => {
      for (const msg of info.messages) {
        if (msg.type === "error") {
          console.error(`[GPUFaceFinder] Face shader error: ${msg.message}`);
        }
      }
    });

    this.facePipeline = this.device.createComputePipeline({
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

    return this.facePipeline;
  }

  private ensureMeshPipeline(): GPUComputePipeline {
    if (this.meshPipeline) return this.meshPipeline;

    const shaderModule = this.device.createShaderModule({
      code: MESH_SHADER,
    });

    shaderModule.getCompilationInfo().then((info) => {
      for (const msg of info.messages) {
        if (msg.type === "error") {
          console.error(`[GPUFaceFinder] Mesh shader error: ${msg.message}`);
        }
      }
    });

    this.meshPipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });

    this.meshParamsBuffer = this.device.createBuffer({
      size: 6 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    return this.meshPipeline;
  }

  private ensureFaceBuffers(totalVoxels: number, mappingLength: number): void {
    const voxelByteSize = Math.ceil(totalVoxels / 4) * 4;
    const faceOutputSize = totalVoxels * 6 * 4 * 4;

    if (totalVoxels !== this.cachedTotalVoxels) {
      this.cachedVoxelBuffer?.destroy();
      this.cachedSelectionBuffer?.destroy();
      this.cachedFaceBuffer?.destroy();

      this.cachedVoxelBuffer = this.device.createBuffer({
        size: voxelByteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.cachedSelectionBuffer = this.device.createBuffer({
        size: voxelByteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.cachedFaceBuffer = this.device.createBuffer({
        size: faceOutputSize,
        usage: GPUBufferUsage.STORAGE,
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

  private ensureMeshBuffers(maxFaces: number): void {
    if (maxFaces === this.cachedMaxFaces) return;

    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;
    const vertBytes = maxVertices * 3 * 4;
    const uvBytes = maxVertices * 2 * 4;
    const scalarBytes = maxVertices * 4;
    const indexBytes = maxIndices * 4;

    const bufs: (GPUBuffer | null)[] = [
      this.cachedCounterBuffer, this.cachedCounterReadBuffer,
      this.cachedVertexBuffer, this.cachedNormalBuffer,
      this.cachedUVBuffer, this.cachedAOBuffer,
      this.cachedIsSelectedBuffer, this.cachedIndexBuffer,
      this.cachedVertexReadBuffer, this.cachedNormalReadBuffer,
      this.cachedUVReadBuffer, this.cachedAOReadBuffer,
      this.cachedIsSelectedReadBuffer, this.cachedIndexReadBuffer,
    ];
    for (const b of bufs) { b?.destroy(); }

    this.cachedCounterBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.cachedCounterReadBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const storageAndCopy = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
    const readAndCopy = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;

    this.cachedVertexBuffer = this.device.createBuffer({ size: vertBytes, usage: storageAndCopy });
    this.cachedNormalBuffer = this.device.createBuffer({ size: vertBytes, usage: storageAndCopy });
    this.cachedUVBuffer = this.device.createBuffer({ size: uvBytes, usage: storageAndCopy });
    this.cachedAOBuffer = this.device.createBuffer({ size: scalarBytes, usage: storageAndCopy });
    this.cachedIsSelectedBuffer = this.device.createBuffer({ size: scalarBytes, usage: storageAndCopy });
    this.cachedIndexBuffer = this.device.createBuffer({ size: indexBytes, usage: storageAndCopy });

    this.cachedVertexReadBuffer = this.device.createBuffer({ size: vertBytes, usage: readAndCopy });
    this.cachedNormalReadBuffer = this.device.createBuffer({ size: vertBytes, usage: readAndCopy });
    this.cachedUVReadBuffer = this.device.createBuffer({ size: uvBytes, usage: readAndCopy });
    this.cachedAOReadBuffer = this.device.createBuffer({ size: scalarBytes, usage: readAndCopy });
    this.cachedIsSelectedReadBuffer = this.device.createBuffer({ size: scalarBytes, usage: readAndCopy });
    this.cachedIndexReadBuffer = this.device.createBuffer({ size: indexBytes, usage: readAndCopy });

    this.cachedMaxFaces = maxFaces;
  }

  async computeMesh(
    voxelData: Uint8Array,
    selectionData: Uint8Array,
    selectionEmpty: boolean,
    blockAtlasMapping: number[],
    dimensions: Vector3,
    textureWidth: number
  ): Promise<GPUMeshResult> {
    const facePipeline = this.ensureFacePipeline();
    const meshPipeline = this.ensureMeshPipeline();

    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    this.ensureFaceBuffers(totalVoxels, blockAtlasMapping.length);

    const maxFaces = totalVoxels * 6;
    this.ensureMeshBuffers(maxFaces);

    this.device.queue.writeBuffer(this.cachedVoxelBuffer!, 0, voxelData);
    this.device.queue.writeBuffer(this.cachedSelectionBuffer!, 0, selectionData);
    this.device.queue.writeBuffer(
      this.cachedMappingBuffer!, 0,
      new Uint32Array(blockAtlasMapping)
    );
    this.device.queue.writeBuffer(
      this.paramsBuffer!, 0,
      new Uint32Array([
        dimensions.x, dimensions.y, dimensions.z,
        totalVoxels, selectionEmpty ? 1 : 0,
      ])
    );

    const totalSlices = dimensions.x * 2 + dimensions.y * 2 + dimensions.z * 2;
    const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);

    this.device.queue.writeBuffer(
      this.meshParamsBuffer!, 0,
      new Uint32Array([
        dimensions.x, dimensions.y, dimensions.z,
        totalSlices, textureWidth, maxDim,
      ])
    );

    this.device.queue.writeBuffer(
      this.cachedCounterBuffer!, 0,
      new Uint32Array([0, 0])
    );

    const faceBindGroup = this.device.createBindGroup({
      layout: facePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cachedVoxelBuffer! } },
        { binding: 1, resource: { buffer: this.cachedSelectionBuffer! } },
        { binding: 2, resource: { buffer: this.cachedMappingBuffer! } },
        { binding: 3, resource: { buffer: this.paramsBuffer! } },
        { binding: 4, resource: { buffer: this.tangentsBuffer! } },
        { binding: 5, resource: { buffer: this.cachedFaceBuffer! } },
      ],
    });

    const meshBindGroup = this.device.createBindGroup({
      layout: meshPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cachedFaceBuffer! } },
        { binding: 1, resource: { buffer: this.meshParamsBuffer! } },
        { binding: 2, resource: { buffer: this.cachedCounterBuffer! } },
        { binding: 3, resource: { buffer: this.cachedVertexBuffer! } },
        { binding: 4, resource: { buffer: this.cachedNormalBuffer! } },
        { binding: 5, resource: { buffer: this.cachedUVBuffer! } },
        { binding: 6, resource: { buffer: this.cachedAOBuffer! } },
        { binding: 7, resource: { buffer: this.cachedIsSelectedBuffer! } },
        { binding: 8, resource: { buffer: this.cachedIndexBuffer! } },
      ],
    });

    const encoder = this.device.createCommandEncoder();

    const facePass = encoder.beginComputePass();
    facePass.setPipeline(facePipeline);
    facePass.setBindGroup(0, faceBindGroup);
    facePass.dispatchWorkgroups(Math.ceil(totalVoxels / WORKGROUP_SIZE));
    facePass.end();

    const meshPass = encoder.beginComputePass();
    meshPass.setPipeline(meshPipeline);
    meshPass.setBindGroup(0, meshBindGroup);
    meshPass.dispatchWorkgroups(totalSlices);
    meshPass.end();

    encoder.copyBufferToBuffer(this.cachedCounterBuffer!, 0, this.cachedCounterReadBuffer!, 0, 8);

    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;
    encoder.copyBufferToBuffer(this.cachedVertexBuffer!, 0, this.cachedVertexReadBuffer!, 0, maxVertices * 3 * 4);
    encoder.copyBufferToBuffer(this.cachedNormalBuffer!, 0, this.cachedNormalReadBuffer!, 0, maxVertices * 3 * 4);
    encoder.copyBufferToBuffer(this.cachedUVBuffer!, 0, this.cachedUVReadBuffer!, 0, maxVertices * 2 * 4);
    encoder.copyBufferToBuffer(this.cachedAOBuffer!, 0, this.cachedAOReadBuffer!, 0, maxVertices * 4);
    encoder.copyBufferToBuffer(this.cachedIsSelectedBuffer!, 0, this.cachedIsSelectedReadBuffer!, 0, maxVertices * 4);
    encoder.copyBufferToBuffer(this.cachedIndexBuffer!, 0, this.cachedIndexReadBuffer!, 0, maxIndices * 4);

    this.device.queue.submit([encoder.finish()]);

    await this.cachedCounterReadBuffer!.mapAsync(GPUMapMode.READ);
    const counters = new Uint32Array(this.cachedCounterReadBuffer!.getMappedRange().slice(0));
    this.cachedCounterReadBuffer!.unmap();

    const vertexCount = counters[0];
    const indexCount = counters[1];

    await Promise.all([
      this.cachedVertexReadBuffer!.mapAsync(GPUMapMode.READ),
      this.cachedNormalReadBuffer!.mapAsync(GPUMapMode.READ),
      this.cachedUVReadBuffer!.mapAsync(GPUMapMode.READ),
      this.cachedAOReadBuffer!.mapAsync(GPUMapMode.READ),
      this.cachedIsSelectedReadBuffer!.mapAsync(GPUMapMode.READ),
      this.cachedIndexReadBuffer!.mapAsync(GPUMapMode.READ),
    ]);

    const verts = new Float32Array(this.cachedVertexReadBuffer!.getMappedRange().slice(0, vertexCount * 3 * 4));
    const norms = new Float32Array(this.cachedNormalReadBuffer!.getMappedRange().slice(0, vertexCount * 3 * 4));
    const uvsData = new Float32Array(this.cachedUVReadBuffer!.getMappedRange().slice(0, vertexCount * 2 * 4));
    const aoData = new Float32Array(this.cachedAOReadBuffer!.getMappedRange().slice(0, vertexCount * 4));
    const isSelData = new Float32Array(this.cachedIsSelectedReadBuffer!.getMappedRange().slice(0, vertexCount * 4));
    const idxData = new Uint32Array(this.cachedIndexReadBuffer!.getMappedRange().slice(0, indexCount * 4));

    this.cachedVertexReadBuffer!.unmap();
    this.cachedNormalReadBuffer!.unmap();
    this.cachedUVReadBuffer!.unmap();
    this.cachedAOReadBuffer!.unmap();
    this.cachedIsSelectedReadBuffer!.unmap();
    this.cachedIndexReadBuffer!.unmap();

    return {
      vertices: verts, normals: norms, uvs: uvsData,
      ao: aoData, isSelected: isSelData,
      indices: idxData,
      vertexCount, indexCount,
    };
  }

  destroy(): void {
    const buffers: (GPUBuffer | null)[] = [
      this.cachedVoxelBuffer, this.cachedSelectionBuffer,
      this.cachedMappingBuffer, this.cachedFaceBuffer,
      this.tangentsBuffer, this.paramsBuffer, this.meshParamsBuffer,
      this.cachedCounterBuffer, this.cachedCounterReadBuffer,
      this.cachedVertexBuffer, this.cachedNormalBuffer,
      this.cachedUVBuffer, this.cachedAOBuffer,
      this.cachedIsSelectedBuffer, this.cachedIndexBuffer,
      this.cachedVertexReadBuffer, this.cachedNormalReadBuffer,
      this.cachedUVReadBuffer, this.cachedAOReadBuffer,
      this.cachedIsSelectedReadBuffer, this.cachedIndexReadBuffer,
    ];
    for (const buf of buffers) { buf?.destroy(); }
    this.cachedVoxelBuffer = null;
    this.cachedSelectionBuffer = null;
    this.cachedMappingBuffer = null;
    this.cachedFaceBuffer = null;
    this.tangentsBuffer = null;
    this.paramsBuffer = null;
    this.meshParamsBuffer = null;
    this.cachedCounterBuffer = null;
    this.cachedCounterReadBuffer = null;
    this.cachedVertexBuffer = null;
    this.cachedNormalBuffer = null;
    this.cachedUVBuffer = null;
    this.cachedAOBuffer = null;
    this.cachedIsSelectedBuffer = null;
    this.cachedIndexBuffer = null;
    this.cachedVertexReadBuffer = null;
    this.cachedNormalReadBuffer = null;
    this.cachedUVReadBuffer = null;
    this.cachedAOReadBuffer = null;
    this.cachedIsSelectedReadBuffer = null;
    this.cachedIndexReadBuffer = null;
    this.facePipeline = null;
    this.meshPipeline = null;
  }
}
