import { describe, it, expect } from "vitest";
import {
  calculateAmbientOcclusion,
  OCCLUSION_LEVELS,
  FACE_TANGENTS,
} from "../ambient-occlusion";
import { VoxelFrame } from "../voxel-frame";
import { createVoxelData, setVoxel } from "./test-helpers";
import type { Vector3 } from "@/state";

/**
 * Helper function to unpack occlusion mask
 * Returns array of 4 occlusion values (one per corner)
 */
function unpackOcclusionMask(mask: number): number[] {
  return [
    (mask >> 0) & 0x3,  // Corner 0
    (mask >> 2) & 0x3,  // Corner 1
    (mask >> 4) & 0x3,  // Corner 2
    (mask >> 6) & 0x3,  // Corner 3
  ];
}

describe("calculateAmbientOcclusion", () => {
  describe("No occlusion cases", () => {
    it("should return zero occlusion for isolated block", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Single block in center with no neighbors
      const mask = calculateAmbientOcclusion(
        1, 1, 1, // center position
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      // All corners should have 0 occluders
      const corners = unpackOcclusionMask(mask);
      expect(corners).toEqual([0, 0, 0, 0]);
    });

    it("should return zero occlusion for block at corner with no neighbors", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Block at corner with no neighbors
      const mask = calculateAmbientOcclusion(
        0, 0, 0, // corner position
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      expect(corners).toEqual([0, 0, 0, 0]);
    });
  });

  describe("Edge occlusion cases", () => {
    it("should detect side neighbor occlusion", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Place a block next to the center block in Y direction
      setVoxel(voxelData, 1, 2, 1, 1); // +Y neighbor

      const mask = calculateAmbientOcclusion(
        1, 1, 1, // center position
        0, // +X face (checks Y and Z tangents)
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      // Corners adjacent to the +Y direction should be occluded
      // For face 0 (+X), u=Y, v=Z
      // Corner 1 (+u,-v) and Corner 2 (+u,+v) have +Y
      expect(corners).toEqual([0, 1, 1, 0]);
    });

    it("should detect multiple side neighbors", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Place blocks on two sides
      setVoxel(voxelData, 1, 2, 1, 1); // +Y neighbor
      setVoxel(voxelData, 1, 1, 2, 1); // +Z neighbor

      const mask = calculateAmbientOcclusion(
        1, 1, 1, // center position
        0, // +X face (tangents are Y and Z)
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      // Corner 2 (+u,+v = +Y,+Z) should have both side occluders
      expect(corners).toEqual([0, 1, 3, 1]);
    });
  });

  describe("Corner occlusion cases", () => {
    it("should detect corner neighbor occlusion", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Place a block at diagonal corner
      setVoxel(voxelData, 1, 2, 2, 1); // +Y, +Z corner

      const mask = calculateAmbientOcclusion(
        1, 1, 1, // center position
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      // The corner facing the diagonal neighbor should be occluded
      // Corner 2 is at +Y,+Z which is the diagonal
      expect(corners).toEqual([0, 0, 1, 0]);
    });
  });

  describe("Inner corner cases", () => {
    it("should detect inner corner (both sides and corner)", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Place blocks to form an inner corner
      setVoxel(voxelData, 1, 2, 1, 1); // +Y side
      setVoxel(voxelData, 1, 1, 2, 1); // +Z side

      const mask = calculateAmbientOcclusion(
        1, 1, 1, // center position
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      // Corner 2 (at +Y, +Z) should have maximum occlusion (value 3)
      // when both sides are present
      expect(corners).toEqual([0, 1, 3, 1]);
    });

    it("should return 3 for inner corner even without diagonal block", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Only place the two side blocks, not the corner
      setVoxel(voxelData, 1, 2, 1, 1); // +Y side
      setVoxel(voxelData, 1, 1, 2, 1); // +Z side
      // No corner block at (1, 2, 2)

      const mask = calculateAmbientOcclusion(
        1, 1, 1, // center position
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      // When both sides are present, occlusion is 3 regardless of corner block
      expect(corners).toEqual([0, 1, 3, 1]);
    });
  });



  describe("Preview frame occlusion", () => {
    it("should not count preview blocks when previewOccludes is false", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Place preview blocks around center
      previewFrame.set(1, 2, 1, 1);
      previewFrame.set(1, 1, 2, 1);

      const mask = calculateAmbientOcclusion(
        1, 1, 1,
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false // preview doesn't occlude
      );

      const corners = unpackOcclusionMask(mask);
      // No occlusion since previewOccludes is false
      expect(corners).toEqual([0, 0, 0, 0]);
    });

    it("should count preview blocks when previewOccludes is true", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Place preview blocks around center
      previewFrame.set(1, 2, 1, 1);
      previewFrame.set(1, 1, 2, 1);

      const mask = calculateAmbientOcclusion(
        1, 1, 1,
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        true // preview occludes
      );

      const corners = unpackOcclusionMask(mask);
      // Should have occlusion from preview blocks
      expect(corners).toEqual([0, 1, 3, 1]);
    });

    it("should combine voxel data and preview frame occlusion", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // One real block, one preview block
      setVoxel(voxelData, 1, 2, 1, 1); // +Y side (real)
      previewFrame.set(1, 1, 2, 1); // +Z side (preview)

      const mask = calculateAmbientOcclusion(
        1, 1, 1,
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        true // preview occludes
      );

      const corners = unpackOcclusionMask(mask);
      // Should have inner corner occlusion from both sources
      expect(corners).toEqual([0, 1, 3, 1]);
    });
  });

  describe("Boundary conditions", () => {
    it("should treat out-of-bounds checks as non-occluding", () => {
      const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Block at edge looking outward - out of bounds should not occlude
      const mask = calculateAmbientOcclusion(
        0, 0, 0,
        1, // -X face (looking outside the world)
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      // All corners should have 0 occlusion (nothing out of bounds occludes)
      expect(corners).toEqual([0, 0, 0, 0]);
    });
  });

  describe("Occlusion mask packing", () => {
    it("should correctly pack different corner values", () => {
      const dimensions: Vector3 = { x: 4, y: 4, z: 4 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Create a specific occlusion pattern for face 0 (+X)
      // For face 0, tangents are u=Y, v=Z
      // Place blocks to create varied occlusion
      setVoxel(voxelData, 2, 1, 2, 1); // -Y side
      setVoxel(voxelData, 2, 3, 2, 1); // +Y side
      setVoxel(voxelData, 2, 2, 3, 1); // +Z side

      const mask = calculateAmbientOcclusion(
        2, 2, 2,
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      const corners = unpackOcclusionMask(mask);
      
      // Verify the pattern based on actual block placement:
      // Corner 0 (-Y,-Z): affected by -Y side = 1
      // Corner 1 (+Y,-Z): affected by +Y side = 1
      // Corner 2 (+Y,+Z): affected by +Y and +Z sides (inner corner) = 3
      // Corner 3 (-Y,+Z): affected by -Y and +Z sides (inner corner) = 3
      expect(corners).toEqual([1, 1, 3, 3]);
    });
  });

  describe("Symmetry tests", () => {
    it("should produce symmetric results for symmetric voxel configurations", () => {
      const dimensions: Vector3 = { x: 5, y: 5, z: 5 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Create symmetric pattern around center block: blocks at +Y and -Y
      setVoxel(voxelData, 2, 3, 2, 1); // +Y
      setVoxel(voxelData, 2, 1, 2, 1); // -Y

      const mask1 = calculateAmbientOcclusion(2, 2, 2, 0, voxelData, dimensions, previewFrame, false);
      const corners1 = unpackOcclusionMask(mask1);

      // For face 0 (+X), with symmetric blocks at ±Y:
      // Corner 1 (+Y,-Z) and corner 2 (+Y,+Z) both have +Y neighbor
      // Corner 0 (-Y,-Z) and corner 3 (-Y,+Z) both have -Y neighbor
      // So corners with +Y should equal each other, and corners with -Y should equal each other
      expect(corners1[1]).toBe(corners1[2]); // Both have +Y neighbor
      expect(corners1[0]).toBe(corners1[3]); // Both have -Y neighbor
      expect(corners1[0]).toBe(corners1[1]); // Both patterns are symmetric
    });
  });

  describe("Complex scenarios", () => {
    it("should handle fully surrounded block", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Surround center block completely
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          for (let z = 0; z < 3; z++) {
            if (x !== 1 || y !== 1 || z !== 1) {
              setVoxel(voxelData, x, y, z, 1);
            }
          }
        }
      }

      const mask = calculateAmbientOcclusion(1, 1, 1, 0, voxelData, dimensions, previewFrame, false);
      const corners = unpackOcclusionMask(mask);

      // All corners should have maximum occlusion
      expect(corners).toEqual([3, 3, 3, 3]);
    });

    it("should handle alternating pattern", () => {
      const dimensions: Vector3 = { x: 5, y: 5, z: 5 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Create checkerboard pattern
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          for (let z = 0; z < 5; z++) {
            if ((x + y + z) % 2 === 0) {
              setVoxel(voxelData, x, y, z, 1);
            }
          }
        }
      }

      // Test center block which has alternating neighbors
      const mask = calculateAmbientOcclusion(2, 2, 2, 0, voxelData, dimensions, previewFrame, false);
      
      expect(mask).toBeDefined();
      const corners = unpackOcclusionMask(mask);
      // Should have some occlusion from the checkerboard pattern
      expect(corners.some(c => c > 0)).toBe(true);
    });
  });
});
