import { describe, it, expect } from "vitest";
import {
  compressVoxelData,
  decompressVoxelDataInto,
} from "../voxel-data-utils";

describe("voxel-data-utils", () => {
  describe("decompressVoxelDataInto", () => {
    it("should decompress data into an existing buffer", () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5, 0, 0, 0]);
      const compressed = compressVoxelData(originalData);

      const targetBuffer = new Uint8Array(8);
      const result = decompressVoxelDataInto(compressed, targetBuffer);

      expect(result).toEqual(originalData);
      expect(result).toBe(targetBuffer); // Should reuse the same buffer
    });

    it("should reuse the same buffer when called multiple times", () => {
      const data1 = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
      const data2 = new Uint8Array([2, 2, 2, 2, 2, 2, 2, 2]);

      const compressed1 = compressVoxelData(data1);
      const compressed2 = compressVoxelData(data2);

      const buffer = new Uint8Array(8);

      // First decompression
      const result1 = decompressVoxelDataInto(compressed1, buffer);
      expect(result1).toEqual(data1);
      expect(result1).toBe(buffer); // Should reuse the same buffer

      // Second decompression reuses the same buffer
      const result2 = decompressVoxelDataInto(compressed2, buffer);
      expect(result2).toEqual(data2);
      expect(result2).toBe(buffer); // Should reuse the same buffer
    });

    it("should resize buffer if size doesn't match", () => {
      const originalData = new Uint8Array([1, 2, 3, 4]);
      const compressed = compressVoxelData(originalData);

      const wrongSizeBuffer = new Uint8Array(8); // Wrong size!

      const result = decompressVoxelDataInto(compressed, wrongSizeBuffer);
      expect(result).toEqual(originalData);
      expect(result).not.toBe(wrongSizeBuffer); // Should be a new buffer
      expect(result.length).toBe(4); // Correct size
    });
  });
});
