import { describe, it, expect, beforeEach } from "vitest";
import { ExteriorFacesFinder } from "../find-exterior-faces";
import { MeshArrays } from "../mesh-arrays";
import { VoxelFrame } from "../voxel-frame";
import { FlatVoxelFrame } from "../flat-voxel-frame";
import { createVoxelData, setVoxel } from "./test-helpers";
import type { Vector3 } from "@/state/types";

/**
 * Helper function to create block atlas mappings
 * Each block type has 6 face texture indices (one for each face direction)
 */
function createBlockAtlasMappings(numBlocks: number): number[][] {
  const mappings: number[][] = [];
  for (let i = 0; i < numBlocks; i++) {
    // All faces use the same texture for simplicity
    mappings.push([i, i, i, i, i, i]);
  }
  return mappings;
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
      setVoxel(voxelData, 0, 0, 0, 1); // Single block

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4, // textureWidth
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
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
            setVoxel(voxelData, x, y, z, 1);
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
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
              setVoxel(voxelData, x, y, z, 1);
            }
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
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
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
      );

      // Empty voxel data should produce no faces
      expect(meshArrays.indexCount).toBe(0);
      expect(meshArrays.vertexCount).toBe(0);
    });

    it("should find correct faces for two adjacent blocks", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1);
      setVoxel(voxelData, 1, 0, 0, 1);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
      );

      // Two adjacent blocks share one face, so they expose 10 individual faces
      // Greedy meshing combines faces: the two blocks form a 2x1x1 shape
      // This results in 6 exterior faces (one merged face per direction)
      expect(meshArrays.indexCount).toBe(36); // 6 faces * 6 indices
      expect(meshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices
    });

    it("should handle preview blocks correctly", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1); // Real block

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      // Add a preview block adjacent to the real block
      previewFrame.set(1, 0, 0, 1);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
      );

      // Real block should have all 6 faces visible since preview blocks
      // are rendered separately and don't occlude the real mesh
      expect(meshArrays.indexCount).toBe(36); // 6 faces * 6 indices
      expect(meshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices

      // Preview block should also have all 6 faces visible  
      // The condition is: !isBlockPresent(neighborValue) || !neighborIsPreview
      // Since the neighbor is a real block (not preview), the preview renders its face
      expect(previewMeshArrays.indexCount).toBe(36); // 6 faces * 6 indices
      expect(previewMeshArrays.vertexCount).toBe(24); // 6 faces * 4 vertices
    });

    it("should mark selection faces with isSelected attribute", () => {
      const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
      const voxelData = createVoxelData(dimensions);
      setVoxel(voxelData, 0, 0, 0, 1); // Real block

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      // Mark the block as selected
      selectionFrame.set(0, 0, 0, 1);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
      );

      // The selected block should have all 6 faces visible
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
      setVoxel(voxelData, 0, 0, 0, 1); // Real block without selection

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        previewFrame,
        selectionFrame,
        true
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

    it("should generate identical geometry for 8x8x8 preview cube and 8x8x8 real cube", () => {
      const dimensions: Vector3 = { x: 8, y: 8, z: 8 };
      
      const realVoxelData = createVoxelData(dimensions);
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          for (let z = 0; z < 8; z++) {
            setVoxel(realVoxelData, x, y, z, 1);
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const realMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const realPreviewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const realPreviewFrame = new VoxelFrame(dimensions);
      const realSelectionFrame = new FlatVoxelFrame(dimensions);

      finder.findExteriorFaces(
        realVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        realMeshArrays,
        realPreviewMeshArrays,
        realPreviewFrame,
        realSelectionFrame,
        true
      );

      const previewVoxelData = createVoxelData(dimensions);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays2 = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const previewSelectionFrame = new FlatVoxelFrame(dimensions);

      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          for (let z = 0; z < 8; z++) {
            previewFrame.set(x, y, z, 1);
          }
        }
      }

      finder.findExteriorFaces(
        previewVoxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        previewMeshArrays,
        previewMeshArrays2,
        previewFrame,
        previewSelectionFrame,
        true
      );

      expect(previewMeshArrays2.indexCount).toBe(realMeshArrays.indexCount);
      expect(previewMeshArrays2.vertexCount).toBe(realMeshArrays.vertexCount);
    });
  });

  describe("Benchmark test", () => {
    it("should handle a large 128x128x128 chunk with polka dot pattern (benchmark only)", () => {
      const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
      const finder = new ExteriorFacesFinder(128);
      const voxelData = createVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      // Set every other voxel with polka dot pattern - alternating between real and preview blocks
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            if ((x + y + z) % 2 === 0) {
              setVoxel(voxelData, x, y, z, 1); // Real blocks
            } else {
              previewFrame.set(x, y, z, 1); // Preview blocks
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
          createBlockAtlasMappings(2),
          dimensions,
          meshArrays,
          previewMeshArrays,
          previewFrame,
          selectionFrame,
          true
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
      console.log(`  Real blocks: ${meshArrays.vertexCount} vertices and ${meshArrays.indexCount} indices`);
      console.log(`  Preview blocks: ${previewMeshArrays.vertexCount} vertices and ${previewMeshArrays.indexCount} indices`);

      // This is a benchmark test - no assertions, just timing
    }, 120000); // 120 second timeout for benchmark

    it("should handle a large 128x128x128 solid cube of real blocks (benchmark only)", () => {
      const dimensions: Vector3 = { x: 128, y: 128, z: 128 };
      const finder = new ExteriorFacesFinder(128);
      const voxelData = createVoxelData(dimensions);

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      // Fill entire cube with real blocks
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            setVoxel(voxelData, x, y, z, 1);
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
          createBlockAtlasMappings(2),
          dimensions,
          meshArrays,
          previewMeshArrays,
          previewFrame,
          selectionFrame,
          true
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
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new FlatVoxelFrame(dimensions);

      // Fill entire cube with preview blocks
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            previewFrame.set(x, y, z, 1);
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
          createBlockAtlasMappings(2),
          dimensions,
          meshArrays,
          previewMeshArrays,
          previewFrame,
          selectionFrame,
          true
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
      console.log(`  Generated ${previewMeshArrays.vertexCount} vertices and ${previewMeshArrays.indexCount} indices`);

      // This is a benchmark test - no assertions, just timing
    }, 120000); // 120 second timeout for benchmark
  });
});
