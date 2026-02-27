import type { Vector3 } from "@/state/types";

export interface RenderSettings {
  sunAzimuth: number;
  sunElevation: number;
  sunIntensity: number;
  sunColorR: number;
  sunColorG: number;
  sunColorB: number;
  ambientIntensity: number;
  shadowDarkness: number;
}

export const defaultRenderSettings: RenderSettings = {
  sunAzimuth: 135,
  sunElevation: 55,
  sunIntensity: 1.4,
  sunColorR: 1.0,
  sunColorG: 0.95,
  sunColorB: 0.9,
  ambientIntensity: 0.35,
  shadowDarkness: 0.7,
};

const computeShader = /* wgsl */ `
struct Uniforms {
  eye: vec3f,
  fov: f32,
  forward: vec3f,
  aspect: f32,
  right: vec3f,
  width: f32,
  up: vec3f,
  height: f32,
  dimX: u32,
  dimY: u32,
  dimZ: u32,
  numColors: u32,
  sunDir: vec3f,
  sunIntensity: f32,
  sunColor: vec3f,
  ambientIntensity: f32,
  shadowDarkness: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var<storage, read> voxels: array<u32>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;
@group(0) @binding(2) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<storage, read> palette: array<u32>;

fn getVoxel(x: i32, y: i32, z: i32) -> u32 {
  if (x < 0 || u32(x) >= uniforms.dimX || y < 0 || u32(y) >= uniforms.dimY || z < 0 || u32(z) >= uniforms.dimZ) {
    return 0u;
  }
  let index = u32(x) * uniforms.dimY * uniforms.dimZ + u32(y) * uniforms.dimZ + u32(z);
  let wordIndex = index / 4u;
  let byteOffset = index % 4u;
  return (voxels[wordIndex] >> (byteOffset * 8u)) & 0xFFu;
}

fn blockColor(blockType: u32) -> vec3f {
  if (blockType == 0u || blockType > uniforms.numColors) {
    return vec3f(1.0, 0.0, 1.0);
  }
  let packed = palette[blockType - 1u];
  let r = f32((packed >> 16u) & 0xFFu) / 255.0;
  let g = f32((packed >> 8u) & 0xFFu) / 255.0;
  let b = f32(packed & 0xFFu) / 255.0;
  return vec3f(r, g, b);
}

struct HitResult {
  hit: bool,
  pos: vec3f,
  normal: vec3f,
  blockType: u32,
  t: f32,
}

fn traceRay(origin: vec3f, dir: vec3f) -> HitResult {
  var result: HitResult;
  result.hit = false;

  let invDir = 1.0 / dir;
  let gridMin = vec3f(0.0);
  let gridMax = vec3f(f32(uniforms.dimX), f32(uniforms.dimY), f32(uniforms.dimZ));

  let t1 = (gridMin - origin) * invDir;
  let t2 = (gridMax - origin) * invDir;
  let tmin_v = min(t1, t2);
  let tmax_v = max(t1, t2);
  let tEnter = max(max(tmin_v.x, tmin_v.y), tmin_v.z);
  let tExit = min(min(tmax_v.x, tmax_v.y), tmax_v.z);

  if (tExit < 0.0 || tEnter > tExit) {
    return result;
  }

  let startT = max(tEnter + 0.001, 0.0);
  var pos = origin + dir * startT;

  var mapPos = vec3i(floor(pos));
  let stepI = vec3i(sign(dir));
  let stepF = sign(dir);

  let deltaDist = abs(invDir);

  var sideDist = (stepF * (vec3f(f32(mapPos.x), f32(mapPos.y), f32(mapPos.z)) - pos) + stepF * 0.5 + 0.5) * deltaDist;

  let maxSteps = i32(uniforms.dimX + uniforms.dimY + uniforms.dimZ) * 2;
  var normal = vec3f(0.0);

  for (var i = 0; i < maxSteps; i++) {
    if (mapPos.x < 0 || u32(mapPos.x) >= uniforms.dimX ||
        mapPos.y < 0 || u32(mapPos.y) >= uniforms.dimY ||
        mapPos.z < 0 || u32(mapPos.z) >= uniforms.dimZ) {
      break;
    }

    let voxel = getVoxel(mapPos.x, mapPos.y, mapPos.z);
    let blockType = voxel & 0x7Fu;
    if (blockType != 0u) {
      result.hit = true;
      result.pos = vec3f(f32(mapPos.x), f32(mapPos.y), f32(mapPos.z));
      result.normal = normal;
      result.blockType = blockType;
      result.t = min(min(sideDist.x, sideDist.y), sideDist.z);
      return result;
    }

    if (sideDist.x < sideDist.y) {
      if (sideDist.x < sideDist.z) {
        sideDist.x += deltaDist.x;
        mapPos.x += stepI.x;
        normal = vec3f(-stepF.x, 0.0, 0.0);
      } else {
        sideDist.z += deltaDist.z;
        mapPos.z += stepI.z;
        normal = vec3f(0.0, 0.0, -stepF.z);
      }
    } else {
      if (sideDist.y < sideDist.z) {
        sideDist.y += deltaDist.y;
        mapPos.y += stepI.y;
        normal = vec3f(0.0, -stepF.y, 0.0);
      } else {
        sideDist.z += deltaDist.z;
        mapPos.z += stepI.z;
        normal = vec3f(0.0, 0.0, -stepF.z);
      }
    }
  }

  return result;
}

fn traceShadow(origin: vec3f, dir: vec3f) -> bool {
  let invDir = 1.0 / dir;
  let gridMin = vec3f(0.0);
  let gridMax = vec3f(f32(uniforms.dimX), f32(uniforms.dimY), f32(uniforms.dimZ));

  let t1 = (gridMin - origin) * invDir;
  let t2 = (gridMax - origin) * invDir;
  let tmin_v = min(t1, t2);
  let tmax_v = max(t1, t2);
  let tEnter = max(max(tmin_v.x, tmin_v.y), tmin_v.z);
  let tExit = min(min(tmax_v.x, tmax_v.y), tmax_v.z);

  if (tExit < 0.0 || tEnter > tExit) {
    return false;
  }

  let startT = max(tEnter + 0.001, 0.0);
  var pos = origin + dir * startT;

  var mapPos = vec3i(floor(pos));
  let stepI = vec3i(sign(dir));
  let stepF = sign(dir);
  let deltaDist = abs(invDir);
  var sideDist = (stepF * (vec3f(f32(mapPos.x), f32(mapPos.y), f32(mapPos.z)) - pos) + stepF * 0.5 + 0.5) * deltaDist;

  let maxSteps = i32(uniforms.dimX + uniforms.dimY + uniforms.dimZ) * 2;

  for (var i = 0; i < maxSteps; i++) {
    if (mapPos.x < 0 || u32(mapPos.x) >= uniforms.dimX ||
        mapPos.y < 0 || u32(mapPos.y) >= uniforms.dimY ||
        mapPos.z < 0 || u32(mapPos.z) >= uniforms.dimZ) {
      return false;
    }

    let voxel = getVoxel(mapPos.x, mapPos.y, mapPos.z);
    if ((voxel & 0x7Fu) != 0u) {
      return true;
    }

    if (sideDist.x < sideDist.y) {
      if (sideDist.x < sideDist.z) {
        sideDist.x += deltaDist.x;
        mapPos.x += stepI.x;
      } else {
        sideDist.z += deltaDist.z;
        mapPos.z += stepI.z;
      }
    } else {
      if (sideDist.y < sideDist.z) {
        sideDist.y += deltaDist.y;
        mapPos.y += stepI.y;
      } else {
        sideDist.z += deltaDist.z;
        mapPos.z += stepI.z;
      }
    }
  }

  return false;
}

fn groundPlane(origin: vec3f, dir: vec3f) -> vec4f {
  if (abs(dir.y) < 0.0001) {
    return vec4f(0.0);
  }
  let t = -origin.y / dir.y;
  if (t < 0.0) {
    return vec4f(0.0);
  }
  let p = origin + dir * t;
  if (p.x < -1.0 || p.x > f32(uniforms.dimX) + 1.0 ||
      p.z < -1.0 || p.z > f32(uniforms.dimZ) + 1.0) {
    return vec4f(0.0);
  }
  let fx = fract(p.x);
  let fz = fract(p.z);
  let lineW = 0.02;
  let grid = f32(fx < lineW || fx > 1.0 - lineW || fz < lineW || fz > 1.0 - lineW);
  var base = vec3f(0.14, 0.14, 0.20);

  let groundNdotL = max(dot(vec3f(0.0, 1.0, 0.0), uniforms.sunDir), 0.0);
  let groundSunLight = uniforms.sunColor * uniforms.sunIntensity * groundNdotL * 0.3;
  base = base * (uniforms.ambientIntensity + groundSunLight);

  let inShadow = traceShadow(p + vec3f(0.0, 0.01, 0.0), uniforms.sunDir);
  if (inShadow) {
    base = base * (1.0 - uniforms.shadowDarkness);
  }

  let line = base + vec3f(0.08, 0.08, 0.10);
  return vec4f(mix(base, line, grid * 0.6), t);
}

fn skyColor(dir: vec3f) -> vec3f {
  let t = dir.y * 0.5 + 0.5;
  let bottom = vec3f(0.094, 0.094, 0.149);
  let top = vec3f(0.12, 0.13, 0.22);
  return mix(bottom, top, clamp(t, 0.0, 1.0));
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x;
  let py = gid.y;
  if (px >= u32(uniforms.width) || py >= u32(uniforms.height)) {
    return;
  }

  let uv = vec2f(
    (f32(px) + 0.5) / uniforms.width * 2.0 - 1.0,
    1.0 - (f32(py) + 0.5) / uniforms.height * 2.0
  );

  let halfH = tan(uniforms.fov * 0.5);
  let halfW = halfH * uniforms.aspect;

  let dir = normalize(
    uniforms.forward + uniforms.right * (uv.x * halfW) + uniforms.up * (uv.y * halfH)
  );

  let hit = traceRay(uniforms.eye, dir);

  var color: vec3f;
  if (hit.hit) {
    let baseColor = blockColor(hit.blockType);

    let hitCenter = hit.pos + vec3f(0.5);
    let shadowOrigin = hitCenter + hit.normal * 0.51;
    let inShadow = traceShadow(shadowOrigin, uniforms.sunDir);

    let ndotl = max(dot(hit.normal, uniforms.sunDir), 0.0);
    let diffuse = uniforms.sunColor * uniforms.sunIntensity * ndotl;

    var lighting = vec3f(uniforms.ambientIntensity);
    if (!inShadow) {
      lighting = lighting + diffuse;
    } else {
      lighting = lighting * (1.0 - uniforms.shadowDarkness);
    }

    color = baseColor * lighting;
  } else {
    let gp = groundPlane(uniforms.eye, dir);
    if (gp.w > 0.0) {
      color = gp.xyz;
    } else {
      color = skyColor(dir);
    }
  }

  color = clamp(color, vec3f(0.0), vec3f(1.0));
  textureStore(output, vec2i(i32(px), i32(py)), vec4f(color, 1.0));
}
`;

const renderVertexShader = /* wgsl */ `
struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) idx: u32) -> VOut {
  var out: VOut;
  let uv = vec2f(f32((idx << 1u) & 2u), f32(idx & 2u));
  out.pos = vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(uv.x, 1.0 - uv.y);
  return out;
}
`;

const renderFragmentShader = /* wgsl */ `
@group(0) @binding(0) var tex: texture_2d<f32>;

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dim = textureDimensions(tex);
  let coord = vec2i(i32(uv.x * f32(dim.x)), i32(uv.y * f32(dim.y)));
  return textureLoad(tex, coord, 0);
}
`;

const UNIFORM_SIZE = 128;

export function packVoxelData(voxels: Uint8Array): Uint32Array {
  const wordCount = Math.ceil(voxels.length / 4);
  const packed = new Uint32Array(wordCount);
  for (let i = 0; i < voxels.length; i++) {
    const wordIndex = i >>> 2;
    const byteOffset = i & 3;
    packed[wordIndex] |= (voxels[i] & 0xff) << (byteOffset * 8);
  }
  return packed;
}

export function packPalette(colors: number[]): Uint32Array {
  const packed = new Uint32Array(colors.length);
  for (let i = 0; i < colors.length; i++) {
    packed[i] = colors[i] & 0xffffff;
  }
  return packed;
}

export function sunDirFromAngles(azimuth: number, elevation: number): [number, number, number] {
  const azRad = (azimuth * Math.PI) / 180;
  const elRad = (elevation * Math.PI) / 180;
  const cosEl = Math.cos(elRad);
  return [
    cosEl * Math.sin(azRad),
    Math.sin(elRad),
    cosEl * Math.cos(azRad),
  ];
}

export function buildUniformData(
  eye: [number, number, number],
  forward: [number, number, number],
  right: [number, number, number],
  up: [number, number, number],
  fov: number,
  aspect: number,
  width: number,
  height: number,
  dims: Vector3,
  settings: RenderSettings
): Float32Array {
  const buf = new Float32Array(UNIFORM_SIZE / 4);
  buf[0] = eye[0]; buf[1] = eye[1]; buf[2] = eye[2]; buf[3] = fov;
  buf[4] = forward[0]; buf[5] = forward[1]; buf[6] = forward[2]; buf[7] = aspect;
  buf[8] = right[0]; buf[9] = right[1]; buf[10] = right[2]; buf[11] = width;
  buf[12] = up[0]; buf[13] = up[1]; buf[14] = up[2]; buf[15] = height;

  const u32View = new Uint32Array(buf.buffer);
  u32View[16] = dims.x;
  u32View[17] = dims.y;
  u32View[18] = dims.z;
  u32View[19] = 0;

  const sunDir = sunDirFromAngles(settings.sunAzimuth, settings.sunElevation);
  buf[20] = sunDir[0]; buf[21] = sunDir[1]; buf[22] = sunDir[2];
  buf[23] = settings.sunIntensity;
  buf[24] = settings.sunColorR; buf[25] = settings.sunColorG; buf[26] = settings.sunColorB;
  buf[27] = settings.ambientIntensity;
  buf[28] = settings.shadowDarkness;
  buf[29] = 0; buf[30] = 0; buf[31] = 0;

  return buf;
}

export class WebGPURayTracer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private canvas: HTMLCanvasElement;
  private computePipeline!: GPUComputePipeline;
  private renderPipeline!: GPURenderPipeline;
  private outputTexture!: GPUTexture;
  private voxelBuffer!: GPUBuffer;
  private uniformBuffer!: GPUBuffer;
  private paletteBuffer!: GPUBuffer;
  private computeBindGroup!: GPUBindGroup;
  private renderBindGroup!: GPUBindGroup;
  private computeBindGroupLayout!: GPUBindGroupLayout;
  private renderBindGroupLayout!: GPUBindGroupLayout;
  private dimensions: Vector3;
  private width: number;
  private height: number;
  private presentationFormat!: GPUTextureFormat;
  private disposed = false;

  private constructor(canvas: HTMLCanvasElement, dimensions: Vector3) {
    this.canvas = canvas;
    this.dimensions = { ...dimensions };
    this.width = canvas.width;
    this.height = canvas.height;
  }

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  static async create(
    canvas: HTMLCanvasElement,
    dimensions: Vector3
  ): Promise<WebGPURayTracer> {
    const tracer = new WebGPURayTracer(canvas, dimensions);
    await tracer.init();
    return tracer;
  }

  private async init(): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("WebGPU adapter not available");

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: "opaque",
    });

    this.createBuffers();
    this.createOutputTexture();
    this.createPipelines();
    this.createBindGroups();
  }

  private createBuffers(): void {
    const totalVoxels = this.dimensions.x * this.dimensions.y * this.dimensions.z;
    const voxelWords = Math.ceil(totalVoxels / 4);
    const voxelByteSize = Math.max(voxelWords * 4, 4);

    this.voxelBuffer = this.device.createBuffer({
      size: voxelByteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.paletteBuffer = this.device.createBuffer({
      size: Math.max(128 * 4, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  private createOutputTexture(): void {
    if (this.outputTexture) {
      this.outputTexture.destroy();
    }
    this.outputTexture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
  }

  private createPipelines(): void {
    this.computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba8unorm" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      ],
    });

    const computeModule = this.device.createShaderModule({ code: computeShader });
    this.computePipeline = this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.computeBindGroupLayout],
      }),
      compute: { module: computeModule, entryPoint: "main" },
    });

    this.renderBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ],
    });

    const vertModule = this.device.createShaderModule({ code: renderVertexShader });
    const fragModule = this.device.createShaderModule({ code: renderFragmentShader });
    this.renderPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.renderBindGroupLayout],
      }),
      vertex: { module: vertModule, entryPoint: "vs" },
      fragment: {
        module: fragModule,
        entryPoint: "fs",
        targets: [{ format: this.presentationFormat }],
      },
      primitive: { topology: "triangle-list" },
    });
  }

  private createBindGroups(): void {
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.voxelBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
        { binding: 2, resource: this.outputTexture.createView() },
        { binding: 3, resource: { buffer: this.paletteBuffer } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: this.outputTexture.createView() },
      ],
    });
  }

  updateVoxels(data: Uint8Array): void {
    if (this.disposed) return;
    const packed = packVoxelData(data);
    this.device.queue.writeBuffer(this.voxelBuffer, 0, packed);
  }

  updatePalette(colors: number[]): void {
    if (this.disposed) return;
    const packed = packPalette(colors);
    this.device.queue.writeBuffer(this.paletteBuffer, 0, packed);

    const numColorsArr = new Uint32Array([colors.length]);
    this.device.queue.writeBuffer(this.uniformBuffer, 76, numColorsArr);
  }

  updateCamera(
    eye: [number, number, number],
    target: [number, number, number],
    fov: number,
    settings: RenderSettings
  ): void {
    if (this.disposed) return;

    const fx = target[0] - eye[0];
    const fy = target[1] - eye[1];
    const fz = target[2] - eye[2];
    const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const forward: [number, number, number] = [fx / fLen, fy / fLen, fz / fLen];

    const worldUp: [number, number, number] = [0, 1, 0];
    let rx = forward[1] * worldUp[2] - forward[2] * worldUp[1];
    let ry = forward[2] * worldUp[0] - forward[0] * worldUp[2];
    let rz = forward[0] * worldUp[1] - forward[1] * worldUp[0];
    const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const right: [number, number, number] = [rx / rLen, ry / rLen, rz / rLen];

    const ux = right[1] * forward[2] - right[2] * forward[1];
    const uy = right[2] * forward[0] - right[0] * forward[2];
    const uz = right[0] * forward[1] - right[1] * forward[0];
    const up: [number, number, number] = [ux, uy, uz];

    const aspect = this.width / this.height;
    const fovRad = (fov * Math.PI) / 180;

    const data = buildUniformData(
      eye, forward, right, up,
      fovRad, aspect,
      this.width, this.height,
      this.dimensions,
      settings
    );

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;

    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: "opaque",
    });

    this.createOutputTexture();
    this.createBindGroups();
  }

  render(): void {
    if (this.disposed) return;

    const encoder = this.device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.computeBindGroup);
    computePass.dispatchWorkgroups(
      Math.ceil(this.width / 8),
      Math.ceil(this.height / 8)
    );
    computePass.end();

    const textureView = this.context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: "clear" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        clearValue: { r: 0.094, g: 0.094, b: 0.149, a: 1 },
      }],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.draw(3);
    renderPass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.voxelBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.paletteBuffer?.destroy();
    this.outputTexture?.destroy();
    this.device?.destroy();
  }
}
