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

  it("does not apply ambient occlusion shading", () => {
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
    const maxAo = aoValues.length ? Math.max(...aoValues) : 1;
    expect(minAo).toBe(1);
    expect(maxAo).toBe(1);
  });

  it("benchmarks meshing with layer + preview setup", () => {
    const dimensions = { x: 64, y: 64, z: 64 };
    const layerCount = 3;
    const benchIterations = 5;
    // Reduced iterations from 10 to 5 to accommodate setup cost within the test timeout.
    const LAYER_SEED_OFFSET = 3;
    const FILL_DENSITY_THRESHOLD = 4;
    const mesher = new OctreeMesher();
    const results: Array<{ label: string; avg: number; min: number; max: number }> = [];

    const createLayerOctree = (seed: number, density: number) => {
      const octree = new SparseVoxelOctree(dimensions);
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            const value = (x * 31 + y * 17 + z * 13 + seed) % 10;
            if (value < density) {
              octree.set(x, y, z, 1);
            }
          }
        }
      }
      return octree;
    };

    const buildRenderOctree = (layers: SparseVoxelOctree[]) => {
      const renderOctree = new SparseVoxelOctree(dimensions);
      for (const layer of layers) {
        layer.forEachLeaf((leaf) => {
          if (leaf.value === 0) {
            return;
          }
          renderOctree.setRegion(
            leaf.minPos,
            { x: leaf.size, y: leaf.size, z: leaf.size },
            leaf.value
          );
        });
      }
      return renderOctree;
    };

    const applyPreviewOverlay = (renderOctree: SparseVoxelOctree) => {
      const previewMin = { x: 20, y: 20, z: 20 };
      const previewSize = { x: 16, y: 16, z: 16 };
      const maxX = previewMin.x + previewSize.x - 1;
      const maxY = previewMin.y + previewSize.y - 1;
      const maxZ = previewMin.z + previewSize.z - 1;

      for (let x = previewMin.x; x <= maxX; x++) {
        for (let y = previewMin.y; y <= maxY; y++) {
          for (let z = previewMin.z; z <= maxZ; z++) {
            const current = renderOctree.get(x, y, z);
            if (current <= 0) {
              continue;
            }
            renderOctree.set(x, y, z, -current);
          }
        }
      }
    };

    const baseLayers = Array.from({ length: layerCount }, (_, index) =>
      createLayerOctree(index + LAYER_SEED_OFFSET, FILL_DENSITY_THRESHOLD)
    );
    const countLeavesByPredicate = (
      octree: SparseVoxelOctree,
      predicate: (value: number) => boolean
    ) => {
      let count = 0;
      octree.forEachLeaf((leaf) => {
        if (predicate(leaf.value)) {
          count += 1;
        }
      });
      return count;
    };

    const measure = (label: string, durations: number[]) => {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      results.push({ label, avg: avgDuration, min: minDuration, max: maxDuration });
    };

    const setupDurations: number[] = [];
    const cullingOnDurations: number[] = [];
    const cullingOffDurations: number[] = [];

    for (let i = 0; i < benchIterations; i++) {
      const setupStart = performance.now();
      const renderOctree = buildRenderOctree(baseLayers);
      applyPreviewOverlay(renderOctree);
      const setupDuration = performance.now() - setupStart;
      setupDurations.push(setupDuration);

      const mainLeaves = countLeavesByPredicate(renderOctree, (value) => value > 0);
      const previewLeaves = countLeavesByPredicate(renderOctree, (value) => value < 0);

      const meshArraysOn = createMeshArrays(mainLeaves);
      const cullingOnStart = performance.now();
      mesher.buildMesh(renderOctree, 4, blockAtlasMappings, meshArraysOn, undefined, {
        enableCulling: true,
        valuePredicate: (value) => value > 0,
        valueTransform: (value) => value,
        occludesValue: (value) => value > 0,
      });
      cullingOnDurations.push(performance.now() - cullingOnStart);
      expect(meshArraysOn.vertexCount).toBeGreaterThan(0);

      const meshArraysOff = createMeshArrays(mainLeaves);
      const cullingOffStart = performance.now();
      mesher.buildMesh(renderOctree, 4, blockAtlasMappings, meshArraysOff, undefined, {
        enableCulling: false,
        valuePredicate: (value) => value > 0,
        valueTransform: (value) => value,
        occludesValue: (value) => value > 0,
      });
      cullingOffDurations.push(performance.now() - cullingOffStart);
      expect(meshArraysOff.vertexCount).toBeGreaterThan(0);

      const previewMeshArrays = createMeshArrays(previewLeaves);
      mesher.buildMesh(renderOctree, 4, blockAtlasMappings, previewMeshArrays, undefined, {
        enableCulling: false,
        valuePredicate: (value) => value < 0,
        valueTransform: (value) => Math.abs(value),
        occludesValue: (value) => value < 0,
      });
      expect(previewMeshArrays.vertexCount).toBeGreaterThan(0);
    }

    measure("Setup (layers + preview)", setupDurations);
    measure("Culling on", cullingOnDurations);
    measure("Culling off", cullingOffDurations);

    console.table(
      results.map((entry) => ({
        label: entry.label,
        avg: `${entry.avg.toFixed(2)}ms`,
        min: `${entry.min.toFixed(2)}ms`,
        max: `${entry.max.toFixed(2)}ms`,
      }))
    );
    expect(results).toHaveLength(3);
    results.forEach((entry) => {
      expect(entry.avg).toBeGreaterThan(0);
    });
  }, 30000);
});
