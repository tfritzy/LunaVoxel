import { describe, it, expect } from "vitest";
import { SparseVoxelOctree } from "../sparse-voxel-octree";
import { OctreeMesher } from "../octree-mesher";
import { MeshArrays } from "../mesh-arrays";

function createBlockAtlasMappings(numBlocks: number): number[][] {
  const mappings: number[][] = [];
  for (let i = 0; i < numBlocks; i++) {
    mappings.push([i, i, i, i, i, i]);
  }
  return mappings;
}

describe("SparseVoxelOctree", () => {
  it("should set and get values", () => {
    const octree = new SparseVoxelOctree();
    octree.set(1, 2, 3, 5);
    expect(octree.get(1, 2, 3)).toBe(5);
    expect(octree.get(0, 0, 0)).toBe(0);
  });

  it("should delete values", () => {
    const octree = new SparseVoxelOctree();
    octree.set(1, 2, 3, 5);
    octree.delete(1, 2, 3);
    expect(octree.get(1, 2, 3)).toBe(0);
    expect(octree.size).toBe(0);
  });

  it("should report correct size", () => {
    const octree = new SparseVoxelOctree();
    octree.set(0, 0, 0, 1);
    octree.set(1, 0, 0, 2);
    expect(octree.size).toBe(2);
    octree.set(0, 0, 0, 0);
    expect(octree.size).toBe(1);
  });

  it("should clone correctly", () => {
    const octree = new SparseVoxelOctree();
    octree.set(1, 2, 3, 5);
    const clone = octree.clone();
    expect(clone.get(1, 2, 3)).toBe(5);
    clone.set(1, 2, 3, 10);
    expect(octree.get(1, 2, 3)).toBe(5);
  });

  it("should merge correctly", () => {
    const a = new SparseVoxelOctree();
    a.set(0, 0, 0, 1);
    const b = new SparseVoxelOctree();
    b.set(1, 0, 0, 2);
    b.set(0, 0, 0, 3);
    a.mergeFrom(b);
    expect(a.get(0, 0, 0)).toBe(3);
    expect(a.get(1, 0, 0)).toBe(2);
  });
});

describe("OctreeMesher", () => {
  const mesher = new OctreeMesher();

  it("should generate 6 faces for a single voxel", () => {
    const octree = new SparseVoxelOctree();
    octree.set(0, 0, 0, 1);

    const meshArrays = new MeshArrays(24, 36);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);

    expect(meshArrays.vertexCount).toBe(24);
    expect(meshArrays.indexCount).toBe(36);
  });

  it("should cull shared faces between adjacent voxels", () => {
    const octree = new SparseVoxelOctree();
    octree.set(0, 0, 0, 1);
    octree.set(1, 0, 0, 1);

    const meshArrays = new MeshArrays(100, 200);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);

    expect(meshArrays.vertexCount).toBe(40);
    expect(meshArrays.indexCount).toBe(60);
  });

  it("should cull all interior faces for a 2x2x2 solid cube", () => {
    const octree = new SparseVoxelOctree();
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++)
        for (let z = 0; z < 2; z++)
          octree.set(x, y, z, 1);

    const meshArrays = new MeshArrays(200, 400);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);

    expect(meshArrays.indexCount).toBe(144);
    expect(meshArrays.vertexCount).toBe(96);
  });

  it("should generate no faces for empty octree", () => {
    const octree = new SparseVoxelOctree();
    const meshArrays = new MeshArrays(24, 36);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);

    expect(meshArrays.vertexCount).toBe(0);
    expect(meshArrays.indexCount).toBe(0);
  });

  it("should skip zero-value entries", () => {
    const octree = new SparseVoxelOctree();
    octree.set(0, 0, 0, 1);
    octree.set(1, 0, 0, 1);

    const meshArrays = new MeshArrays(100, 200);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);

    expect(meshArrays.vertexCount).toBe(40);
    expect(meshArrays.indexCount).toBe(60);
  });

  describe("Benchmarks", () => {
    it("should handle 64x64x64 solid cube meshing (benchmark)", () => {
      const octree = new SparseVoxelOctree();
      for (let x = 0; x < 64; x++)
        for (let y = 0; y < 64; y++)
          for (let z = 0; z < 64; z++)
            octree.set(x, y, z, 1);

      const maxFaces = 64 * 64 * 6 * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);

      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      console.log(`64x64x64 solid cube:`);
      console.log(`  Setup: ${octree.size} voxels`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      console.log(`  Vertices: ${meshArrays.vertexCount}, Indices: ${meshArrays.indexCount}`);
    }, 60000);

    it("should handle 64x64x64 polka dot pattern (benchmark)", () => {
      const octree = new SparseVoxelOctree();
      for (let x = 0; x < 64; x++)
        for (let y = 0; y < 64; y++)
          for (let z = 0; z < 64; z++)
            if ((x + y + z) % 2 === 0)
              octree.set(x, y, z, 1);

      const maxFaces = octree.size * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);

      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      console.log(`64x64x64 polka dot:`);
      console.log(`  Setup: ${octree.size} voxels`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      console.log(`  Vertices: ${meshArrays.vertexCount}, Indices: ${meshArrays.indexCount}`);
    }, 60000);

    it("should handle 128x128x128 solid cube (benchmark)", () => {
      const octree = new SparseVoxelOctree();
      for (let x = 0; x < 128; x++)
        for (let y = 0; y < 128; y++)
          for (let z = 0; z < 128; z++)
            octree.set(x, y, z, 1);

      const maxFaces = 128 * 128 * 6 * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      console.log(`128x128x128 solid cube:`);
      console.log(`  Setup: ${octree.size} voxels`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      console.log(`  Vertices: ${meshArrays.vertexCount}, Indices: ${meshArrays.indexCount}`);
    }, 120000);

    it("should handle 128x128x128 polka dot pattern (benchmark)", () => {
      const octree = new SparseVoxelOctree();
      for (let x = 0; x < 128; x++)
        for (let y = 0; y < 128; y++)
          for (let z = 0; z < 128; z++)
            if ((x + y + z) % 2 === 0)
              octree.set(x, y, z, 1);

      const maxFaces = octree.size * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      console.log(`128x128x128 polka dot:`);
      console.log(`  Setup: ${octree.size} voxels`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      console.log(`  Vertices: ${meshArrays.vertexCount}, Indices: ${meshArrays.indexCount}`);
    }, 120000);

    it("64x64 multi-layer merge scenario (benchmark)", () => {
      const layer1 = new SparseVoxelOctree();
      const layer2 = new SparseVoxelOctree();
      for (let x = 0; x < 64; x++) {
        for (let y = 0; y < 32; y++) {
          for (let z = 0; z < 64; z++) {
            layer1.set(x, y, z, 1);
          }
        }
        for (let y = 32; y < 64; y++) {
          for (let z = 0; z < 64; z++) {
            layer2.set(x, y, z, 2);
          }
        }
      }

      const maxFaces = (layer1.size + layer2.size) * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);

      const iterations = 5;
      const setupDurations: number[] = [];
      const meshDurations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const setupStart = performance.now();
        const rt = layer1.clone();
        rt.mergeFrom(layer2);
        setupDurations.push(performance.now() - setupStart);

        const meshStart = performance.now();
        mesher.buildMesh(rt, 4, createBlockAtlasMappings(3), meshArrays);
        meshDurations.push(performance.now() - meshStart);
      }

      const setupAvg = setupDurations.reduce((a, b) => a + b, 0) / setupDurations.length;
      const meshAvg = meshDurations.reduce((a, b) => a + b, 0) / meshDurations.length;
      console.log(`64x64 multi-layer merge:`);
      console.log(`  Setup avg: ${setupAvg.toFixed(2)}ms`);
      console.log(`  Mesh avg: ${meshAvg.toFixed(2)}ms`);
      console.log(`  Total avg: ${(setupAvg + meshAvg).toFixed(2)}ms`);
      console.log(`  Vertices: ${meshArrays.vertexCount}, Indices: ${meshArrays.indexCount}`);
    }, 120000);
  });
});
