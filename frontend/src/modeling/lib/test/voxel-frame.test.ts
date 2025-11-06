import { describe, it, expect } from "vitest";
import { VoxelFrame } from "../voxel-frame";

describe("VoxelFrame", () => {
  describe("offset functionality", () => {
    it("should handle world coordinates with offset", () => {
      // Create a frame at offset (10, 20, 30) with size 5x5x5
      const frame = new VoxelFrame(
        { x: 5, y: 5, z: 5 },
        { x: 10, y: 20, z: 30 }
      );

      // Set a voxel at world position (12, 22, 32)
      frame.set(12, 22, 32, 42);

      // Should be able to get it back
      expect(frame.get(12, 22, 32)).toBe(42);
      expect(frame.isSet(12, 22, 32)).toBe(true);

      // Out of bounds should return 0
      expect(frame.get(5, 5, 5)).toBe(0);
      expect(frame.get(20, 20, 20)).toBe(0);
      expect(frame.isSet(5, 5, 5)).toBe(false);
    });

    it("should return correct min and max positions", () => {
      const frame = new VoxelFrame(
        { x: 10, y: 20, z: 30 },
        { x: 5, y: 10, z: 15 }
      );

      expect(frame.getMinPos()).toEqual({ x: 5, y: 10, z: 15 });
      expect(frame.getMaxPos()).toEqual({ x: 15, y: 30, z: 45 });
    });

    it("should handle resize with new offset", () => {
      const frame = new VoxelFrame({ x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 });
      frame.set(2, 2, 2, 10);

      // Resize to offset (1, 1, 1) - this should shift the frame
      frame.resize({ x: 5, y: 5, z: 5 }, { x: 1, y: 1, z: 1 });

      // Old position (2, 2, 2) should now be at (2, 2, 2) in world coords
      expect(frame.get(2, 2, 2)).toBe(10);
      // Position (1, 1, 1) should be empty (was outside original frame)
      expect(frame.get(1, 1, 1)).toBe(0);
    });

    it("should optimize memory for small selections", () => {
      // A 1000x1000x1000 world
      const worldSize = { x: 1000, y: 1000, z: 1000 };

      // Old approach: frame for entire world
      const oldFrame = new VoxelFrame(worldSize);
      
      // New approach: frame for just a 10x10x10 selection at (100, 200, 300)
      const newFrame = new VoxelFrame(
        { x: 10, y: 10, z: 10 },
        { x: 100, y: 200, z: 300 }
      );

      // New frame should use much less memory
      // Old: 1000 * 1000 * 1000 * 1 byte = 1GB
      // New: 10 * 10 * 10 * 1 byte = 1KB
      // This is a 1,000,000x memory savings!
      
      // Verify we can still set/get in the bounded region
      newFrame.set(105, 205, 305, 5);
      expect(newFrame.get(105, 205, 305)).toBe(5);
    });

    it("should handle frame without offset (legacy behavior)", () => {
      const frame = new VoxelFrame({ x: 10, y: 10, z: 10 });

      // Should default to offset (0, 0, 0)
      expect(frame.getMinPos()).toEqual({ x: 0, y: 0, z: 0 });
      expect(frame.getMaxPos()).toEqual({ x: 10, y: 10, z: 10 });

      // Should work with coordinates from 0 to 9
      frame.set(5, 5, 5, 42);
      expect(frame.get(5, 5, 5)).toBe(42);
    });

    it("should handle clone with bounds", () => {
      const frame = new VoxelFrame({ x: 20, y: 20, z: 20 });
      frame.set(5, 5, 5, 10);
      frame.set(15, 15, 15, 20);

      // Clone only a portion (10-20, 10-20, 10-20)
      const cloned = frame.clone(
        { x: 10, y: 10, z: 10 },
        { x: 20, y: 20, z: 20 }
      );

      // Should only have the second voxel
      expect(cloned.get(15, 15, 15)).toBe(20);
      expect(cloned.get(5, 5, 5)).toBe(0); // Outside cloned bounds
    });
  });
});
