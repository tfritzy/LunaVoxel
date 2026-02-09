import { describe, it, expect } from "vitest";
import { SparseVoxelOctree, INVISIBLE_FLAG } from "../sparse-voxel-octree";
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

  it("should support invisible flag", () => {
    const value = SparseVoxelOctree.makeValue(5, true, false);
    expect(SparseVoxelOctree.blockType(value)).toBe(5);
    expect(SparseVoxelOctree.isInvisible(value)).toBe(true);
    expect(SparseVoxelOctree.isIgnoreRaycast(value)).toBe(false);
  });

  it("should support ignoreRaycast flag", () => {
    const value = SparseVoxelOctree.makeValue(3, false, true);
    expect(SparseVoxelOctree.blockType(value)).toBe(3);
    expect(SparseVoxelOctree.isInvisible(value)).toBe(false);
    expect(SparseVoxelOctree.isIgnoreRaycast(value)).toBe(true);
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

  it("should generate faces for invisible block with ao=0", () => {
    const octree = new SparseVoxelOctree();
    octree.set(0, 0, 0, 1 | INVISIBLE_FLAG);

    const meshArrays = new MeshArrays(24, 36);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);

    expect(meshArrays.vertexCount).toBe(24);
    expect(meshArrays.indexCount).toBe(36);
    for (let i = 0; i < meshArrays.vertexCount; i++) {
      expect(meshArrays.ao[i]).toBe(0.0);
    }
  });

  it("should cull faces between normal blocks and invisible blocks", () => {
    const octree = new SparseVoxelOctree();
    octree.set(0, 0, 0, 1);
    octree.set(1, 0, 0, 1 | INVISIBLE_FLAG);

    const meshArrays = new MeshArrays(100, 200);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays);

    expect(meshArrays.vertexCount).toBe(40);
    expect(meshArrays.indexCount).toBe(60);
  });

  it("should respect global occupancy mask to skip already-rendered positions", () => {
    const octree = new SparseVoxelOctree();
    octree.set(0, 0, 0, 1);
    octree.set(1, 0, 0, 1);

    const globalOccupancy = new Uint8Array(8 * 8 * 8);
    const gStrideX = 8 * 8;
    const gStrideY = 8;
    globalOccupancy[0 * gStrideX + 0 * gStrideY + 0] = 1;

    const meshArrays = new MeshArrays(100, 200);
    mesher.buildMesh(octree, 4, createBlockAtlasMappings(2), meshArrays, globalOccupancy, gStrideX, gStrideY);

    expect(meshArrays.vertexCount).toBe(20);
    expect(meshArrays.indexCount).toBe(30);
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

    it("64x64 multi-layer with occupancy mask (benchmark)", () => {
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
      const meshArrays1 = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const meshArrays2 = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const mesher1 = new OctreeMesher();
      const mesher2 = new OctreeMesher();

      const globalOcc = new Uint8Array(64 * 64 * 64);
      const gStrideX = 64 * 64;
      const gStrideY = 64;

      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        globalOcc.fill(0);
        const start = performance.now();
        mesher1.buildMesh(layer2, 4, createBlockAtlasMappings(3), meshArrays1, globalOcc, gStrideX, gStrideY);
        mesher2.buildMesh(layer1, 4, createBlockAtlasMappings(3), meshArrays2, globalOcc, gStrideX, gStrideY);
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`64x64 multi-layer with occupancy mask:`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  Layer 1: Vertices: ${meshArrays2.vertexCount}, Layer 2: Vertices: ${meshArrays1.vertexCount}`);
    }, 120000);
  });
});
