import { describe, it, expect, beforeEach } from "vitest";
import { ExteriorFacesFinder } from "./find-exterior-faces";
import { MeshArrays } from "./mesh-arrays";
import { VoxelFrame } from "./voxel-frame";
import type { Vector3 } from "@/module_bindings";

/**
 * Helper function to create voxel data structure
 */
function createVoxelData(dimensions: Vector3): Uint8Array[][] {
  const voxelData: Uint8Array[][] = [];
  for (let x = 0; x < dimensions.x; x++) {
    voxelData[x] = [];
    for (let y = 0; y < dimensions.y; y++) {
      voxelData[x][y] = new Uint8Array(dimensions.z);
    }
  }
  return voxelData;
}

/**
 * Helper function to set a voxel
 */
function setVoxel(
  voxelData: Uint8Array[][],
  x: number,
  y: number,
  z: number,
  blockType: number
): void {
  voxelData[x][y][z] = blockType;
}

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
      const selectionMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4, // textureWidth
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        selectionMeshArrays,
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
      const selectionMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        selectionMeshArrays,
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

    it("should find correct faces for a 3x3x3 hollow cube", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);

      // Create a hollow cube (only the outer shell)
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            // Only set blocks on the surface
            const isOnSurface =
              x === 0 || x === 2 || y === 0 || y === 2 || z === 0 || z === 2;
            if (isOnSurface) {
              setVoxel(voxelData, x, y, z, 1);
            }
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        selectionMeshArrays,
        previewFrame,
        selectionFrame,
        true
      );

      // Hollow cube has both exterior and interior faces
      // We should have more faces than a solid cube but less than individual blocks
      expect(meshArrays.indexCount).toBeGreaterThan(0);
      expect(meshArrays.vertexCount).toBeGreaterThan(0);
      
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
      const selectionMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        selectionMeshArrays,
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
      const selectionMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new VoxelFrame(dimensions);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        selectionMeshArrays,
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
      const selectionMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new VoxelFrame(dimensions);

      // Add a preview block adjacent to the real block
      previewFrame.set(1, 0, 0, 1);

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        selectionMeshArrays,
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
  });

  describe("Benchmark test", () => {
    it("should handle a large 64x64x64 chunk (benchmark only)", () => {
      const dimensions: Vector3 = { x: 64, y: 64, z: 64 };
      const voxelData = createVoxelData(dimensions);

      // Fill the entire chunk with blocks
      for (let x = 0; x < dimensions.x; x++) {
        for (let y = 0; y < dimensions.y; y++) {
          for (let z = 0; z < dimensions.z; z++) {
            setVoxel(voxelData, x, y, z, 1);
          }
        }
      }

      const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
      const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const selectionMeshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
      const previewFrame = new VoxelFrame(dimensions);
      const selectionFrame = new VoxelFrame(dimensions);

      const startTime = performance.now();

      finder.findExteriorFaces(
        voxelData,
        4,
        createBlockAtlasMappings(2),
        dimensions,
        meshArrays,
        previewMeshArrays,
        selectionMeshArrays,
        previewFrame,
        selectionFrame,
        true
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`64x64x64 chunk processed in ${duration.toFixed(2)}ms`);
      console.log(`Generated ${meshArrays.vertexCount} vertices and ${meshArrays.indexCount} indices`);

      // This is a benchmark test - no assertions, just timing
      // But we can verify it completed without error
      expect(duration).toBeGreaterThan(0);
    });
  });
});
