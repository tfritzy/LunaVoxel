import { describe, it, expect } from "vitest";
import { VoxelFrame } from "../voxel-frame";

describe("VoxelFrame", () => {
  describe("offset functionality", () => {
    it("should handle world coordinates with offset", () => {
      const frame = new VoxelFrame(
        { x: 5, y: 5, z: 5 },
        { x: 10, y: 20, z: 30 }
      );

      frame.set(12, 22, 32, 42);

      expect(frame.get(12, 22, 32)).toBe(42);
      expect(frame.isSet(12, 22, 32)).toBe(true);

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

      frame.resize({ x: 5, y: 5, z: 5 }, { x: 1, y: 1, z: 1 });

      expect(frame.get(2, 2, 2)).toBe(10);
      expect(frame.get(1, 1, 1)).toBe(0);
    });

    it("should handle frame without offset", () => {
      const frame = new VoxelFrame({ x: 10, y: 10, z: 10 });

      expect(frame.getMinPos()).toEqual({ x: 0, y: 0, z: 0 });
      expect(frame.getMaxPos()).toEqual({ x: 10, y: 10, z: 10 });

      frame.set(5, 5, 5, 42);
      expect(frame.get(5, 5, 5)).toBe(42);
    });

    it("should handle clone with bounds", () => {
      const frame = new VoxelFrame({ x: 20, y: 20, z: 20 });
      frame.set(5, 5, 5, 10);
      frame.set(15, 15, 15, 20);

      const cloned = frame.clone(
        { x: 10, y: 10, z: 10 },
        { x: 20, y: 20, z: 20 }
      );

      expect(cloned.get(15, 15, 15)).toBe(20);
      expect(cloned.get(5, 5, 5)).toBe(0);
    });
  });

  describe("capacity-based resizing", () => {
    it("should preserve data across incremental resizes", () => {
      const frame = new VoxelFrame({ x: 3, y: 3, z: 3 }, { x: 0, y: 0, z: 0 });
      frame.set(1, 1, 1, 10);

      frame.resize({ x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 });
      expect(frame.get(1, 1, 1)).toBe(10);

      frame.set(4, 4, 4, 20);
      frame.resize({ x: 7, y: 7, z: 7 }, { x: 0, y: 0, z: 0 });
      expect(frame.get(1, 1, 1)).toBe(10);
      expect(frame.get(4, 4, 4)).toBe(20);
    });

    it("should preserve data when resizing to include negative offsets", () => {
      const frame = new VoxelFrame({ x: 3, y: 3, z: 3 }, { x: 5, y: 5, z: 5 });
      frame.set(6, 6, 6, 42);

      frame.resize({ x: 10, y: 10, z: 10 }, { x: 2, y: 2, z: 2 });
      expect(frame.get(6, 6, 6)).toBe(42);
      expect(frame.get(2, 2, 2)).toBe(0);
    });

    it("should return correct logical dimensions after resize", () => {
      const frame = new VoxelFrame({ x: 3, y: 3, z: 3 }, { x: 0, y: 0, z: 0 });
      frame.resize({ x: 5, y: 5, z: 5 }, { x: 1, y: 1, z: 1 });

      expect(frame.getDimensions()).toEqual({ x: 5, y: 5, z: 5 });
      expect(frame.getMinPos()).toEqual({ x: 1, y: 1, z: 1 });
      expect(frame.getMaxPos()).toEqual({ x: 6, y: 6, z: 6 });
    });

    it("should not return data outside logical bounds after resize", () => {
      const frame = new VoxelFrame({ x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 });
      frame.set(3, 3, 3, 10);

      frame.resize({ x: 10, y: 10, z: 10 }, { x: 0, y: 0, z: 0 });
      frame.set(8, 8, 8, 20);

      frame.resize({ x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 });
      expect(frame.get(3, 3, 3)).toBe(10);
      expect(frame.get(8, 8, 8)).toBe(0);
    });

    it("should handle clear and reuse with capacity", () => {
      const frame = new VoxelFrame({ x: 3, y: 3, z: 3 }, { x: 0, y: 0, z: 0 });
      frame.set(1, 1, 1, 10);

      frame.resize({ x: 10, y: 10, z: 10 }, { x: 0, y: 0, z: 0 });
      frame.clear();

      frame.resize({ x: 5, y: 5, z: 5 }, { x: 2, y: 2, z: 2 });
      expect(frame.get(1, 1, 1)).toBe(0);
      expect(frame.get(3, 3, 3)).toBe(0);
      frame.set(3, 3, 3, 42);
      expect(frame.get(3, 3, 3)).toBe(42);
    });
  });
});
