import { describe, it, expect } from "vitest";
import {
  calculateAmbientOcclusion,
  OCCLUSION_LEVELS,
  FACE_TANGENTS,
} from "./ambient-occlusion";
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

describe("OCCLUSION_LEVELS", () => {
  it("should define correct occlusion values", () => {
    expect(OCCLUSION_LEVELS).toEqual([1.0, 0.9, 0.85, 0.75]);
  });

  it("should have 4 levels", () => {
    expect(OCCLUSION_LEVELS).toHaveLength(4);
  });

  it("should be in descending order", () => {
    for (let i = 0; i < OCCLUSION_LEVELS.length - 1; i++) {
      expect(OCCLUSION_LEVELS[i]).toBeGreaterThan(OCCLUSION_LEVELS[i + 1]);
    }
  });

  it("should have maximum value of 1.0 for no occlusion", () => {
    expect(OCCLUSION_LEVELS[0]).toBe(1.0);
  });
});

describe("FACE_TANGENTS", () => {
  it("should define tangents for all 6 faces", () => {
    expect(Object.keys(FACE_TANGENTS)).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(FACE_TANGENTS[i]).toBeDefined();
    }
  });

  it("should have u and v vectors for each face", () => {
    for (let i = 0; i < 6; i++) {
      expect(FACE_TANGENTS[i].u).toBeDefined();
      expect(FACE_TANGENTS[i].v).toBeDefined();
      expect(FACE_TANGENTS[i].u).toHaveLength(3);
      expect(FACE_TANGENTS[i].v).toHaveLength(3);
    }
  });

  it("should have perpendicular tangent vectors", () => {
    // For each face, u and v should be perpendicular (dot product = 0)
    for (let i = 0; i < 6; i++) {
      const { u, v } = FACE_TANGENTS[i];
      const dotProduct = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      expect(dotProduct).toBe(0);
    }
  });

  it("should have unit tangent vectors", () => {
    // Each tangent vector should have length 1
    for (let i = 0; i < 6; i++) {
      const { u, v } = FACE_TANGENTS[i];
      const uLength = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
      const vLength = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      expect(uLength).toBe(1);
      expect(vLength).toBe(1);
    }
  });
});

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
      expect(corners[1]).toBeGreaterThan(0);
      expect(corners[2]).toBeGreaterThan(0);
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
      // Corner 2 (+u,+v = +Y,+Z) should have the most occlusion (both sides)
      expect(corners[2]).toBeGreaterThan(0);
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
      expect(corners[2]).toBeGreaterThan(0);
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
      expect(corners[2]).toBe(3);
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
      expect(corners[2]).toBe(3);
    });
  });

  describe("All face directions", () => {
    it("should work correctly for face 0 (+X)", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      const mask = calculateAmbientOcclusion(1, 1, 1, 0, voxelData, dimensions, previewFrame, false);
      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
    });

    it("should work correctly for face 1 (-X)", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      const mask = calculateAmbientOcclusion(1, 1, 1, 1, voxelData, dimensions, previewFrame, false);
      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
    });

    it("should work correctly for face 2 (+Y)", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      const mask = calculateAmbientOcclusion(1, 1, 1, 2, voxelData, dimensions, previewFrame, false);
      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
    });

    it("should work correctly for face 3 (-Y)", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      const mask = calculateAmbientOcclusion(1, 1, 1, 3, voxelData, dimensions, previewFrame, false);
      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
    });

    it("should work correctly for face 4 (+Z)", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      const mask = calculateAmbientOcclusion(1, 1, 1, 4, voxelData, dimensions, previewFrame, false);
      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
    });

    it("should work correctly for face 5 (-Z)", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      const mask = calculateAmbientOcclusion(1, 1, 1, 5, voxelData, dimensions, previewFrame, false);
      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
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
      expect(corners[2]).toBe(3); // Inner corner
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
      expect(corners[2]).toBe(3);
    });
  });

  describe("Boundary conditions", () => {
    it("should handle blocks at world boundaries", () => {
      const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Block at edge of world
      const mask = calculateAmbientOcclusion(
        0, 0, 0, // corner of world
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      // Should not crash and should return valid mask
      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
      expect(mask).toBeGreaterThanOrEqual(0);
    });

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

    it("should handle maximum coordinates", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Block at maximum coordinates
      const mask = calculateAmbientOcclusion(
        2, 2, 2,
        0, // +X face
        voxelData,
        dimensions,
        previewFrame,
        false
      );

      expect(mask).toBeDefined();
      expect(typeof mask).toBe("number");
    });
  });

  describe("Occlusion mask packing", () => {
    it("should pack 4 corner values in 8 bits", () => {
      const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      const mask = calculateAmbientOcclusion(1, 1, 1, 0, voxelData, dimensions, previewFrame, false);

      // Mask should fit in 8 bits (4 corners * 2 bits each)
      expect(mask).toBeGreaterThanOrEqual(0);
      expect(mask).toBeLessThanOrEqual(255);
    });

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
      expect(corners[0]).toBe(1);
      expect(corners[1]).toBe(1);
      expect(corners[2]).toBe(3);
      expect(corners[3]).toBe(3);
    });
  });

  describe("Symmetry tests", () => {
    it("should produce symmetric results for symmetric voxel configurations", () => {
      const dimensions: Vector3 = { x: 5, y: 5, z: 5 };
      const voxelData = createVoxelData(dimensions);
      const previewFrame = new VoxelFrame(dimensions);

      // Create symmetric pattern around center block
      setVoxel(voxelData, 2, 3, 2, 1); // +Y
      setVoxel(voxelData, 2, 1, 2, 1); // -Y

      const mask1 = calculateAmbientOcclusion(2, 2, 2, 0, voxelData, dimensions, previewFrame, false);
      const corners1 = unpackOcclusionMask(mask1);

      // Corners on +Y side should equal corners on -Y side
      expect(corners1[2]).toBe(corners1[0]); // +u,+v vs -u,-v
      expect(corners1[3]).toBe(corners1[1]); // -u,+v vs +u,-v
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
      expect(corners[0]).toBe(3);
      expect(corners[1]).toBe(3);
      expect(corners[2]).toBe(3);
      expect(corners[3]).toBe(3);
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
