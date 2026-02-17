import { describe, it, expect, beforeEach } from "vitest";
import { ExteriorFacesFinder } from "../find-exterior-faces";
import { MeshArrays } from "../mesh-arrays";
import { VoxelFrame } from "../voxel-frame";
import { createVoxelData, setVoxel } from "./test-helpers";
import type { Vector3 } from "@/state/types";

function createBlockAtlasMapping(numBlocks: number): number[] {
  const mapping: number[] = [];
  for (let i = 0; i < numBlocks; i++) {
    mapping.push(i);
  }
  return mapping;
}

describe("GPU face finder", () => {
  let finder: ExteriorFacesFinder;

  beforeEach(() => {
    finder = new ExteriorFacesFinder(64);
  });

  it("findExteriorFacesGPU should fall back when GPU not available", async () => {
    const dimensions: Vector3 = { x: 1, y: 1, z: 1 };
    const voxelData = createVoxelData(dimensions);
    setVoxel(voxelData, 0, 0, 0, 1, dimensions);
    const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
    const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
    const selectionFrame = new VoxelFrame(dimensions);

    const result = await finder.findExteriorFacesGPU(
      voxelData,
      4,
      createBlockAtlasMapping(2),
      dimensions,
      meshArrays,
      selectionFrame
    );

    expect(result).toBe(false);
  });

  describe("CPU path benchmarks for comparison", () => {
    it("should benchmark CPU path for 32x32x32 polka dot", () => {
      const dimensions: Vector3 = { x: 32, y: 32, z: 32 };
      const voxelData = createVoxelData(dimensions);
      for (let x = 0; x < dimensions.x; x++)
        for (let y = 0; y < dimensions.y; y++)
          for (let z = 0; z < dimensions.z; z++)
            if ((x + y + z) % 2 === 0)
              setVoxel(voxelData, x, y, z, 1, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);
      const finder32 = new ExteriorFacesFinder(32);

      const iterations = 5;
      const durations: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        finder32.findExteriorFaces(
          voxelData, 4, createBlockAtlasMapping(2),
          dimensions, meshArrays, selectionFrame
        );
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`CPU 32x32x32 polka dot: avg=${avg.toFixed(2)}ms, vertices=${meshArrays.vertexCount}, indices=${meshArrays.indexCount}`);
    });

    it("should benchmark CPU path for 64x64x64 polka dot", () => {
      const dimensions: Vector3 = { x: 64, y: 64, z: 64 };
      const voxelData = createVoxelData(dimensions);
      for (let x = 0; x < dimensions.x; x++)
        for (let y = 0; y < dimensions.y; y++)
          for (let z = 0; z < dimensions.z; z++)
            if ((x + y + z) % 2 === 0)
              setVoxel(voxelData, x, y, z, 1, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);
      const finder64 = new ExteriorFacesFinder(64);

      const iterations = 3;
      const durations: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        finder64.findExteriorFaces(
          voxelData, 4, createBlockAtlasMapping(2),
          dimensions, meshArrays, selectionFrame
        );
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`CPU 64x64x64 polka dot: avg=${avg.toFixed(2)}ms, vertices=${meshArrays.vertexCount}, indices=${meshArrays.indexCount}`);
    });

    it("should benchmark CPU path for 64x64x64 solid cube", () => {
      const dimensions: Vector3 = { x: 64, y: 64, z: 64 };
      const voxelData = createVoxelData(dimensions);
      for (let x = 0; x < dimensions.x; x++)
        for (let y = 0; y < dimensions.y; y++)
          for (let z = 0; z < dimensions.z; z++)
            setVoxel(voxelData, x, y, z, 1, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);
      const finder64 = new ExteriorFacesFinder(64);

      const iterations = 5;
      const durations: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        finder64.findExteriorFaces(
          voxelData, 4, createBlockAtlasMapping(2),
          dimensions, meshArrays, selectionFrame
        );
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`CPU 64x64x64 solid cube: avg=${avg.toFixed(2)}ms, vertices=${meshArrays.vertexCount}, indices=${meshArrays.indexCount}`);
    });
  });
});
