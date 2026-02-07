import { describe, it, expect } from "vitest";
import { SparseVoxelOctree } from "../sparse-voxel-octree";
import { OctreeMesher } from "../octree-mesher";
import { MeshArrays } from "../mesh-arrays";

const blockAtlasMappings = [[0, 0, 0, 0, 0, 0]];

const createMeshArrays = (leafCount: number) =>
  new MeshArrays(leafCount * 6 * 4, leafCount * 6 * 6);

describe("SparseVoxelOctree", () => {
  it("stores and retrieves voxel values", () => {
    const octree = new SparseVoxelOctree({ x: 4, y: 4, z: 4 });

    octree.set(1, 1, 1, 2);

    expect(octree.get(1, 1, 1)).toBe(2);
    expect(octree.get(3, 3, 3)).toBe(0);
  });

  it("collapses uniform regions into a single leaf", () => {
    const octree = new SparseVoxelOctree({ x: 4, y: 4, z: 4 });

    octree.setRegion({ x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 4 }, 1);

    expect(octree.countLeaves()).toBe(1);
  });
});

describe("OctreeMesher", () => {
  it("generates six faces per leaf", () => {
    const octree = new SparseVoxelOctree({ x: 4, y: 4, z: 4 });
    octree.setRegion({ x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 4 }, 1);

    const mesher = new OctreeMesher();
    const meshArrays = createMeshArrays(octree.countLeaves());

    mesher.buildMesh(octree, 4, blockAtlasMappings, meshArrays);

    expect(meshArrays.vertexCount).toBe(24);
    expect(meshArrays.indexCount).toBe(36);
  });

  it("culls shared faces between leaves", () => {
    const octree = new SparseVoxelOctree({ x: 4, y: 4, z: 4 });
    octree.set(0, 0, 0, 1);
    octree.set(1, 0, 0, 1);

    const leafCount = octree.countLeaves();
    const mesher = new OctreeMesher();
    const meshArrays = createMeshArrays(leafCount);

    mesher.buildMesh(octree, 4, blockAtlasMappings, meshArrays);

    expect(meshArrays.vertexCount).toBe(40);
    expect(meshArrays.indexCount).toBe(60);
  });

  it("applies ambient occlusion near occupied neighbors", () => {
    const octree = new SparseVoxelOctree({ x: 3, y: 3, z: 3 });
    octree.set(0, 0, 0, 1);
    octree.set(1, 0, 1, 1);
    octree.set(1, 1, 0, 1);
    octree.set(1, 0, 0, 1);

    const leafCount = octree.countLeaves();
    const mesher = new OctreeMesher();
    const meshArrays = createMeshArrays(leafCount);

    mesher.buildMesh(octree, 4, blockAtlasMappings, meshArrays);

    const aoValues = meshArrays.getAO();
    const minAo = aoValues.length ? Math.min(...aoValues) : 1;
    expect(minAo).toBeLessThan(1);
  });

  it("benchmarks meshing with AO/culling toggles", () => {
    const dimensions = { x: 24, y: 24, z: 24 };
    const octree = new SparseVoxelOctree(dimensions);
    for (let x = 0; x < dimensions.x; x++) {
      for (let y = 0; y < dimensions.y; y++) {
        for (let z = 0; z < dimensions.z; z++) {
          if ((x + y + z) % 2 === 0) {
            octree.set(x, y, z, 1);
          }
        }
      }
    }

    const leafCount = octree.countLeaves();
    const mesher = new OctreeMesher();
    const meshArrays = createMeshArrays(leafCount);
    const iterations = 10;

    const runBenchmark = (label: string, options: { enableAO: boolean; enableCulling: boolean }) => {
      const durations: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        mesher.buildMesh(octree, 4, blockAtlasMappings, meshArrays, undefined, options);
        durations.push(performance.now() - start);
      }
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      console.log(`${label}: avg=${avgDuration.toFixed(2)}ms min=${minDuration.toFixed(2)}ms max=${maxDuration.toFixed(2)}ms`);
    };

    runBenchmark("AO+culling", { enableAO: true, enableCulling: true });
    runBenchmark("AO only", { enableAO: true, enableCulling: false });
    runBenchmark("Culling only", { enableAO: false, enableCulling: true });
    runBenchmark("AO+culling disabled", { enableAO: false, enableCulling: false });
  }, 120000);
});
