import { describe, it, beforeAll } from "vitest";
import { MeshArrays } from "../mesh-arrays";
import { VoxelFrame } from "../voxel-frame";
import { createVoxelData, setVoxel } from "./test-helpers";
import type { Vector3 } from "@/state/types";
import { readFileSync } from "fs";
import { resolve } from "path";

function createBlockAtlasMapping(numBlocks: number): number[] {
  const mapping: number[] = [];
  for (let i = 0; i < numBlocks; i++) {
    mapping.push(i);
  }
  return mapping;
}

describe("WASM ExteriorFacesFinder Benchmark", () => {
  let WasmExteriorFacesFinder: any;

  beforeAll(async () => {
    const wasmPath = "/home/runner/work/LunaVoxel/LunaVoxel/frontend/src/wasm/lunavoxel_wasm_bg.wasm";
    const wasmBuffer = readFileSync(wasmPath);

    const wasmModule = await import("@/wasm/lunavoxel_wasm");

    const module = await WebAssembly.compile(wasmBuffer);
    await wasmModule.default({ module_or_path: module });
    WasmExteriorFacesFinder = wasmModule.WasmExteriorFacesFinder;
  });

  it("should handle 128x128x128 polka dot pattern via WASM", async () => {
    const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
    const voxelData = createVoxelData(dimensions);
    const selectionFrame = new VoxelFrame(dimensions);

    for (let x = 0; x < dimensions.x; x++) {
      for (let y = 0; y < dimensions.y; y++) {
        for (let z = 0; z < dimensions.z; z++) {
          if ((x + y + z) % 2 === 0) {
            setVoxel(voxelData, x, y, z, 1, dimensions);
          }
        }
      }
    }

    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    const maxFaces = totalVoxels * 6;
    const finder = new WasmExteriorFacesFinder(128);
    const mapping = new Int32Array(createBlockAtlasMapping(2));

    const iterations = 3;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      finder.findExteriorFaces(
        voxelData,
        4,
        mapping,
        dimensions.x,
        dimensions.y,
        dimensions.z,
        maxFaces * 4,
        maxFaces * 6,
        new Uint8Array(0),
        0, 0, 0,
        true
      );
      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const vertexCount = finder.getVertexCount();
    const indexCount = finder.getIndexCount();
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);

    console.log(`WASM 128x128x128 polka dot: avg=${avgDuration.toFixed(2)}ms min=${minDuration.toFixed(2)}ms verts=${vertexCount} indices=${indexCount}`);
  }, 120000);

  it("should handle 128x128x128 solid cube via WASM", async () => {
    const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
    const voxelData = createVoxelData(dimensions);

    for (let x = 0; x < dimensions.x; x++) {
      for (let y = 0; y < dimensions.y; y++) {
        for (let z = 0; z < dimensions.z; z++) {
          setVoxel(voxelData, x, y, z, 1, dimensions);
        }
      }
    }

    const maxVertices = 128 * 128 * 24;
    const maxIndices = 128 * 128 * 36;
    const finder = new WasmExteriorFacesFinder(128);
    const mapping = new Int32Array(createBlockAtlasMapping(2));

    const iterations = 3;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      finder.findExteriorFaces(
        voxelData,
        4,
        mapping,
        dimensions.x,
        dimensions.y,
        dimensions.z,
        maxVertices,
        maxIndices,
        new Uint8Array(0),
        0, 0, 0,
        true
      );
      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const vertexCount = finder.getVertexCount();
    const indexCount = finder.getIndexCount();
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);

    console.log(`WASM 128x128x128 solid: avg=${avgDuration.toFixed(2)}ms min=${minDuration.toFixed(2)}ms verts=${vertexCount} indices=${indexCount}`);
  }, 120000);
});
