import { describe, it, expect, beforeEach } from "vitest";
import { ExteriorFacesFinder } from "../find-exterior-faces";
import { MeshArrays } from "../mesh-arrays";
import { FlatVoxelFrame } from "../flat-voxel-frame";
import { createPaddedVoxelData, setPaddedVoxel, getPaddedDimensions } from "./test-helpers";
import type { Vector3 } from "@/state/types";
import { RAYCASTABLE_BIT } from "../voxel-constants";

/**
 * Helper function to create block atlas mappings
 * Each block type has 6 face texture indices (one for each face direction)
 */
function createBlockAtlasMappings(numBlocks: number): number[][] {
  const mappings: number[][] = [];
  for (let i = 0; i < numBlocks; i++) {
    mappings.push([i, i, i, i, i, i]);
  }
  return mappings;
}

describe("ExteriorFacesFinder", () => {
  let finder: ExteriorFacesFinder;

  beforeEach(() => {
    finder = new ExteriorFacesFinder(64);
  });

  describe("Small chunk tests", () => {
    it("should find 6 faces for a single block", () => {
      const dimensions: Vector3 = { x: 1, y: 1, z: 1 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);
      setPaddedVoxel(paddedVoxelData, 0, 0, 0, 1, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });

    it("should find correct faces for a 2x2x2 cube", () => {
      const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          for (let z = 0; z < 2; z++) {
            setPaddedVoxel(paddedVoxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });

    it("should find correct faces for a 3x3x3 cube with a hole", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            const isOnSurface =
              x === 0 || x === 2 || y === 0 || y === 2 || z === 0 || z === 2;
            const isHole = z === 0 && x === 1 && y === 1;
            if (isOnSurface && !isHole) {
              setPaddedVoxel(paddedVoxelData, x, y, z, 1, dimensions);
            }
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(108);
      expect(meshArrays.vertexCount).toBe(72);
      
      expect(meshArrays.indexCount % 6).toBe(0);
      expect(meshArrays.vertexCount % 4).toBe(0);
    });

    it("should handle empty voxel data", () => {
      const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(0);
      expect(meshArrays.vertexCount).toBe(0);
    });

    it("should find correct faces for two adjacent blocks", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);
      setPaddedVoxel(paddedVoxelData, 0, 0, 0, 1, dimensions);
      setPaddedVoxel(paddedVoxelData, 1, 0, 0, 1, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });

    it("should handle two adjacent blocks with different block types", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);
      setPaddedVoxel(paddedVoxelData, 0, 0, 0, 1, dimensions);
      setPaddedVoxel(paddedVoxelData, 1, 0, 0, 2, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(3),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(60);
      expect(meshArrays.vertexCount).toBe(40);
    });

    it("should mark selection faces with isSelected attribute", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      selectionFrame.set(0, 0, 0, 1);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);

      const isSelectedArray = meshArrays.getIsSelected();
      for (let i = 0; i < meshArrays.vertexCount; i++) {
        expect(isSelectedArray[i]).toBe(1);
      }
    });

    it("should not mark non-selected faces with isSelected attribute", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);
      setPaddedVoxel(paddedVoxelData, 0, 0, 0, 1, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);

      const isSelectedArray = meshArrays.getIsSelected();
      for (let i = 0; i < meshArrays.vertexCount; i++) {
        expect(isSelectedArray[i]).toBe(0);
      }
    });

    it("should generate identical geometry for 8x8x8 solid cubes", () => {
      const dimensions: Vector3 = { x: 8, y: 8, z: 8 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);
      
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          for (let z = 0; z < 8; z++) {
            setPaddedVoxel(paddedVoxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });
  });

  describe("Preview voxel tests", () => {
    it("should not render faces for erase preview (raycastable-only with zero block type)", () => {
      const dimensions: Vector3 = { x: 1, y: 1, z: 1 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);
      setPaddedVoxel(paddedVoxelData, 0, 0, 0, RAYCASTABLE_BIT, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(0);
      expect(meshArrays.vertexCount).toBe(0);
    });

    it("should render faces for attach preview toward erase preview", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);
      setPaddedVoxel(paddedVoxelData, 0, 0, 0, 1, dimensions);
      setPaddedVoxel(paddedVoxelData, 1, 0, 0, RAYCASTABLE_BIT, dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
        meshArrays,
        selectionFrame
      );

      expect(meshArrays.indexCount).toBe(36);
      expect(meshArrays.vertexCount).toBe(24);
    });

    it("should render interior faces for attach preview surrounded by erase preview", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            if (x === 1 && y === 1 && z === 1) {
              setPaddedVoxel(paddedVoxelData, x, y, z, 1, dimensions);
            } else {
              setPaddedVoxel(paddedVoxelData, x, y, z, RAYCASTABLE_BIT, dimensions);
            }
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        paddedVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        paddedDimensions,
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
      const paddedDimensions = getPaddedDimensions(dimensions);
      const finder = new ExteriorFacesFinder(128);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            if ((x + y + z) % 2 === 0) {
              setPaddedVoxel(paddedVoxelData, x, y, z, 1, dimensions);
            }
          }
        }
      }

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        finder.findExteriorFaces(
          paddedVoxelData,
          4,
          createBlockAtlasMappings(2),
          dimensions,
          paddedDimensions,
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
    }, 120000);

    it("should handle a large 128x128x128 solid cube of real blocks (benchmark only)", () => {
      const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const finder = new ExteriorFacesFinder(128);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            setPaddedVoxel(paddedVoxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        finder.findExteriorFaces(
          paddedVoxelData,
          4,
          createBlockAtlasMappings(2),
          dimensions,
          paddedDimensions,
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
    }, 120000);

    it("should handle a large 128x128x128 solid cube of preview blocks (benchmark only)", () => {
      const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
      const paddedDimensions = getPaddedDimensions(dimensions);
      const finder = new ExteriorFacesFinder(128);
      const paddedVoxelData = createPaddedVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            setPaddedVoxel(paddedVoxelData, x, y, z, 1, dimensions);
          }
        }
      }

      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        finder.findExteriorFaces(
          paddedVoxelData,
          4,
          createBlockAtlasMappings(2),
          dimensions,
          paddedDimensions,
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
    }, 120000);
  });
});
