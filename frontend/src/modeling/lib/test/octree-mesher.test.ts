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
});
