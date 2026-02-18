import { describe, it, expect } from "vitest";
import { ExteriorFacesFinder } from "../find-exterior-faces";
import { MeshArrays } from "../mesh-arrays";
import { VoxelFrame } from "../voxel-frame";

function createFilledVoxelData(dimX: number, dimY: number, dimZ: number): Uint8Array {
  return new Uint8Array(dimX * dimY * dimZ).fill(1);
}

function createSparseVoxelData(dimX: number, dimY: number, dimZ: number): Uint8Array {
  const data = new Uint8Array(dimX * dimY * dimZ);
  for (let x = 0; x < dimX; x++) {
    for (let y = 0; y < dimY; y++) {
      for (let z = 0; z < dimZ; z++) {
        if ((x + y + z) % 2 === 0) {
          data[x * dimY * dimZ + y * dimZ + z] = 1;
        }
      }
    }
  }
  return data;
}

describe("Find Exterior Faces AO Benchmark", () => {
  it("benchmark solid 32x32x32", () => {
    const [dx, dy, dz] = [32, 32, 32];
    const data = createFilledVoxelData(dx, dy, dz);
    const mapping = Array.from({ length: 2 }, (_, i) => i);
    const maxDim = Math.max(dx, dy, dz);
    const finder = new ExteriorFacesFinder(maxDim);
    const totalVoxels = dx * dy * dz;
    const maxFaces = totalVoxels * 6;
    const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
    const emptySelection = new VoxelFrame({ x: dx, y: dy, z: dz });
    const dims = { x: dx, y: dy, z: dz };

    const warmup = 3;
    const iterations = 20;
    for (let i = 0; i < warmup; i++) {
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
    }
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
      times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`TS solid_32x32x32: avg=${avg.toFixed(3)}ms`);
    expect(avg).toBeGreaterThan(0);
  });

  it("benchmark sparse 32x32x32", () => {
    const [dx, dy, dz] = [32, 32, 32];
    const data = createSparseVoxelData(dx, dy, dz);
    const mapping = Array.from({ length: 2 }, (_, i) => i);
    const maxDim = Math.max(dx, dy, dz);
    const finder = new ExteriorFacesFinder(maxDim);
    const totalVoxels = dx * dy * dz;
    const maxFaces = totalVoxels * 6;
    const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
    const emptySelection = new VoxelFrame({ x: dx, y: dy, z: dz });
    const dims = { x: dx, y: dy, z: dz };

    const warmup = 3;
    const iterations = 10;
    for (let i = 0; i < warmup; i++) {
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
    }
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
      times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`TS sparse_32x32x32: avg=${avg.toFixed(3)}ms`);
    expect(avg).toBeGreaterThan(0);
  });

  it("benchmark solid 64x64x64", () => {
    const [dx, dy, dz] = [64, 64, 64];
    const data = createFilledVoxelData(dx, dy, dz);
    const mapping = Array.from({ length: 2 }, (_, i) => i);
    const maxDim = Math.max(dx, dy, dz);
    const finder = new ExteriorFacesFinder(maxDim);
    const totalVoxels = dx * dy * dz;
    const maxFaces = totalVoxels * 6;
    const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
    const emptySelection = new VoxelFrame({ x: dx, y: dy, z: dz });
    const dims = { x: dx, y: dy, z: dz };

    const warmup = 2;
    const iterations = 5;
    for (let i = 0; i < warmup; i++) {
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
    }
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
      times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`TS solid_64x64x64: avg=${avg.toFixed(3)}ms`);
    expect(avg).toBeGreaterThan(0);
  });

  it("benchmark sparse 64x64x64", () => {
    const [dx, dy, dz] = [64, 64, 64];
    const data = createSparseVoxelData(dx, dy, dz);
    const mapping = Array.from({ length: 2 }, (_, i) => i);
    const maxDim = Math.max(dx, dy, dz);
    const finder = new ExteriorFacesFinder(maxDim);
    const totalVoxels = dx * dy * dz;
    const maxFaces = totalVoxels * 6;
    const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
    const emptySelection = new VoxelFrame({ x: dx, y: dy, z: dz });
    const dims = { x: dx, y: dy, z: dz };

    const warmup = 2;
    const iterations = 3;
    for (let i = 0; i < warmup; i++) {
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
    }
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      finder.findExteriorFaces(data, 4, mapping, dims, meshArrays, emptySelection);
      times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`TS sparse_64x64x64: avg=${avg.toFixed(3)}ms`);
    expect(avg).toBeGreaterThan(0);
  });
});
