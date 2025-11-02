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
      decompressVoxelDataInto(compressed, targetBuffer);

      expect(targetBuffer).toEqual(originalData);
    });

    it("should reuse the same buffer when called multiple times", () => {
      const data1 = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
      const data2 = new Uint8Array([2, 2, 2, 2, 2, 2, 2, 2]);

      const compressed1 = compressVoxelData(data1);
      const compressed2 = compressVoxelData(data2);

      const buffer = new Uint8Array(8);

      // First decompression
      decompressVoxelDataInto(compressed1, buffer);
      expect(buffer).toEqual(data1);

      // Second decompression reuses the same buffer
      decompressVoxelDataInto(compressed2, buffer);
      expect(buffer).toEqual(data2);
    });

    it("should throw an error if buffer size doesn't match", () => {
      const originalData = new Uint8Array([1, 2, 3, 4]);
      const compressed = compressVoxelData(originalData);

      const wrongSizeBuffer = new Uint8Array(8); // Wrong size!

      expect(() => {
        decompressVoxelDataInto(compressed, wrongSizeBuffer);
      }).toThrow("Target buffer length");
    });
  });
});
