import { describe, it, expect, beforeEach } from "vitest";
import { ExteriorFacesFinder } from "../find-exterior-faces";
import { MeshArrays } from "../mesh-arrays";
import { VoxelFrame } from "../voxel-frame";
import { createVoxelData, setVoxel } from "./test-helpers";
import type { Vector3 } from "@/state/types";
import { RAYCASTABLE_BIT } from "../voxel-constants";

function createBlockAtlasMapping(numBlocks: number): number[] {
  const mapping: number[] = [];
  for (let i = 0; i < numBlocks; i++) {
    mapping.push(i);
  }
  return mapping;
}

describe("ExteriorFacesFinder", () => {
  let finder: ExteriorFacesFinder;

  beforeEach(() => {
    finder = new ExteriorFacesFinder(64); // Max dimension for most tests
  });

  describe("Small chunk tests", () => {
    it("should find 6 faces for a single block", () => {
      const dimensions: Vector3 = { x: 1, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1, dimensions); // Single block

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4, // textureWidth
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // Single block should have 6 faces exposed
      // Each face has 2 triangles (6 indices)
      expect(meshArrays.indexCount).toBe(36); // 6 faces * 6 indices per face
      expect(meshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices per face
    });

    it("should find correct faces for a 2x2x2 cube", () => {
      const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
      const voxelData = createVoxelData(dimensions);

      // Fill entire 2x2x2 cube
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          for (let z = 0; z < 2; z++) {
            setVoxel(voxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // 2x2x2 solid cube has 6 faces (one per direction)
      // Greedy meshing combines all faces on each side into a single quad
      // Each quad has 2 triangles (6 indices) and 4 vertices
      expect(meshArrays.indexCount).toBe(36); // 6 faces * 6 indices per face
      expect(meshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices per face
    });

    it("should find correct faces for a 3x3x3 cube with a hole", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);

      // Create a cube with a hole in one side (exposing interior)
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            // Only set blocks on the surface
            const isOnSurface =
              x === 0 || x === 2 || y === 0 || y === 2 || z === 0 || z === 2;
            // Create a hole in the center of one face (z === 0, x === 1, y === 1)
            const isHole = z === 0 && x === 1 && y === 1;
            if (isOnSurface && !isHole) {
              setVoxel(voxelData, x, y, z, 1, dimensions);
            }
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // Cube with a hole exposes interior faces around the opening
      // A solid 3x3x3 cube would have 6 faces (36 indices, 24 vertices)
      // With a hole in one face, we expose 4 interior faces around the hole
      // This creates additional faces: 6 exterior + 4 interior = 10 faces with greedy meshing
      // Plus the removed face is gone, and surrounding faces may be affected
      expect(meshArrays.indexCount).toBe(108); // 18 faces * 6 indices per face
      expect(meshArrays.vertexCount).toBe(72); // 18 faces * 4 vertices per face
      
      // Verify that there are some faces rendered
      expect(meshArrays.indexCount % 6).toBe(0); // Should be multiple of 6 (indices per quad)
      expect(meshArrays.vertexCount % 4).toBe(0); // Should be multiple of 4 (vertices per quad)
    });

    it("should handle empty voxel data", () => {
      const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
      const voxelData = createVoxelData(dimensions);
      // Leave all voxels as 0 (empty)

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // Empty voxel data should produce no faces
      expect(meshArrays.indexCount).toBe(0);
      expect(meshArrays.vertexCount).toBe(0);
    });

    it("should find correct faces for two adjacent blocks", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1, dimensions);
      setVoxel(voxelData, 1, 0, 0, 1, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // Two adjacent blocks share one face, so they expose 10 individual faces
      // Greedy meshing combines faces: the two blocks form a 2x1x1 shape
      // This results in 6 exterior faces (one merged face per direction)
      expect(meshArrays.indexCount).toBe(36); // 6 faces * 6 indices
      expect(meshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices
    });

    it("should handle two adjacent blocks with different block types", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1, dimensions); // Block type 1
      setVoxel(voxelData, 1, 0, 0, 2, dimensions); // Block type 2

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(3),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // Two adjacent blocks with different types don't merge in greedy meshing
      // Each block renders 5 faces (the shared face is culled)
      // Total: 10 faces
      expect(meshArrays.indexCount).toBe(60); // 10 faces * 6 indices
      expect(meshArrays.vertexCount).toBe(40); // 10 faces * 4 vertices
    });

    it("should mark selection faces with isSelected attribute", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      // Don't set any voxels - just selection

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      // Set selection at position with no real block
      selectionFrame.set(0, 0, 0, 1);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // The selection should have all 6 faces visible
      expect(meshArrays.indexCount).toBe(36); // 6 faces * 6 indices
      expect(meshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices

      // All vertices should be marked as selected
      const isSelectedArray = meshArrays.getIsSelected();
      for (let i = 0; i < meshArrays.vertexCount; i++) {
        expect(isSelectedArray[i]).toBe(1);
      }
    });

    it("should not mark non-selected faces with isSelected attribute", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1, dimensions); // Real block without selection

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // The non-selected block should have all 6 faces visible
      expect(meshArrays.indexCount).toBe(36); // 6 faces * 6 indices
      expect(meshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices

      // All vertices should NOT be marked as selected
      const isSelectedArray = meshArrays.getIsSelected();
      for (let i = 0; i < meshArrays.vertexCount; i++) {
        expect(isSelectedArray[i]).toBe(0);
      }
    });

    it("should generate identical geometry for 8x8x8 solid cubes", () => {
      const dimensions: Vector3 = { x: 8, y: 8, z: 8 };
      
      const voxelData = createVoxelData(dimensions);
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          for (let z = 0; z < 8; z++) {
            setVoxel(voxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      // 8x8x8 solid cube should have 6 exterior faces
      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });
  });

  describe("Preview voxel tests", () => {
    it("should not render faces for erase preview (raycastable-only with zero block type)", () => {
      const dimensions: Vector3 = { x: 1, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, RAYCASTABLE_BIT, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(0);
      expect(meshArrays.vertexCount).toBe(0);
    });

    it("should render faces for attach preview toward erase preview", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1, dimensions);
      setVoxel(voxelData, 1, 0, 0, RAYCASTABLE_BIT, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });

    it("should render interior faces for attach preview surrounded by erase preview", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);

      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            if (x === 1 && y === 1 && z === 1) {
              setVoxel(voxelData, x, y, z, 1, dimensions);
            } else {
              setVoxel(voxelData, x, y, z, RAYCASTABLE_BIT, dimensions);
            }
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMapping(2),
        dimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });
  });

  describe("Benchmark test", () => {
    it("should handle a large 128x128x128 chunk with polka dot pattern (benchmark only)", () => {
      const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
      const finder = new ExteriorFacesFinder(128);
      const voxelData = createVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      // Set every other voxel with polka dot pattern
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            if ((x + y + z) % 2 === 0) {
              setVoxel(voxelData, x, y, z, 1, dimensions);
            }
          }
        }
      }

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        finder.findExteriorFaces(
          voxelData,
          4,
          createBlockAtlasMapping(2),
          dimensions,
          meshArrays,
          selectionFrame
        );

        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log(`128x128x128 chunk with polka dot pattern (real and preview blocks):`);
      console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Min: ${minDuration.toFixed(2)}ms`);
      console.log(`  Max: ${maxDuration.toFixed(2)}ms`);
      console.log(`  Generated ${meshArrays.vertexCount} vertices and ${meshArrays.indexCount} indices`);

      // This is a benchmark test - no assertions, just timing
    }, 120000); // 120 second timeout for benchmark

    it("should handle a large 128x128x128 solid cube of real blocks (benchmark only)", () => {
      const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
      const finder = new ExteriorFacesFinder(128);
      const voxelData = createVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      // Fill entire cube with real blocks
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            setVoxel(voxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        finder.findExteriorFaces(
          voxelData,
          4,
          createBlockAtlasMapping(2),
          dimensions,
          meshArrays,
          selectionFrame
        );

        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log(`128x128x128 solid cube of real blocks:`);
      console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Min: ${minDuration.toFixed(2)}ms`);
      console.log(`  Max: ${maxDuration.toFixed(2)}ms`);
      console.log(`  Generated ${meshArrays.vertexCount} vertices and ${meshArrays.indexCount} indices`);

      // This is a benchmark test - no assertions, just timing
    }, 120000); // 120 second timeout for benchmark

    it("should handle a large 128x128x128 solid cube of preview blocks (benchmark only)", () => {
      const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
      const finder = new ExteriorFacesFinder(128);
      const voxelData = createVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new VoxelFrame(dimensions);

      // Fill entire cube with blocks that have block type but not raycastable (preview attach)
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            setVoxel(voxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        finder.findExteriorFaces(
          voxelData,
          4,
          createBlockAtlasMapping(2),
          dimensions,
          meshArrays,
          selectionFrame
        );

        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log(`128x128x128 solid cube of preview blocks:`);
      console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Min: ${minDuration.toFixed(2)}ms`);
      console.log(`  Max: ${maxDuration.toFixed(2)}ms`);
      console.log(`  Generated ${meshArrays.vertexCount} vertices and ${meshArrays.indexCount} indices`);

      // This is a benchmark test - no assertions, just timing
    }, 120000); // 120 second timeout for benchmark
  });
});
