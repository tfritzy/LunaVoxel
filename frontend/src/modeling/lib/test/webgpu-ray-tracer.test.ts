import { describe, it, expect } from "vitest";
import { packVoxelData, packPalette, buildUniformData, sunDirFromAngles, defaultRenderSettings } from "../webgpu-ray-tracer";

describe("WebGPU Ray Tracer utilities", () => {
  describe("packVoxelData", () => {
    it("should pack single voxel into u32", () => {
      const voxels = new Uint8Array([0x81]);
      const packed = packVoxelData(voxels);
      expect(packed.length).toBe(1);
      expect(packed[0]).toBe(0x81);
    });

    it("should pack 4 voxels into one u32", () => {
      const voxels = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const packed = packVoxelData(voxels);
      expect(packed.length).toBe(1);
      expect(packed[0]).toBe(0x04030201);
    });

    it("should pack 5 voxels into two u32s", () => {
      const voxels = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const packed = packVoxelData(voxels);
      expect(packed.length).toBe(2);
      expect(packed[0]).toBe(0x04030201);
      expect(packed[1]).toBe(0x05);
    });

    it("should handle empty data", () => {
      const voxels = new Uint8Array(0);
      const packed = packVoxelData(voxels);
      expect(packed.length).toBe(0);
    });

    it("should handle all zeros", () => {
      const voxels = new Uint8Array(8);
      const packed = packVoxelData(voxels);
      expect(packed.length).toBe(2);
      expect(packed[0]).toBe(0);
      expect(packed[1]).toBe(0);
    });

    it("should preserve block type mask and raycastable bit", () => {
      const voxels = new Uint8Array([0x81, 0x00, 0x7F, 0x80]);
      const packed = packVoxelData(voxels);
      expect(packed.length).toBe(1);
      expect((packed[0] >> 0) & 0xFF).toBe(0x81);
      expect((packed[0] >> 8) & 0xFF).toBe(0x00);
      expect((packed[0] >> 16) & 0xFF).toBe(0x7F);
      expect((packed[0] >> 24) & 0xFF).toBe(0x80);
    });
  });

  describe("packPalette", () => {
    it("should pack hex colors", () => {
      const colors = [0xFF0000, 0x00FF00, 0x0000FF];
      const packed = packPalette(colors);
      expect(packed.length).toBe(3);
      expect(packed[0]).toBe(0xFF0000);
      expect(packed[1]).toBe(0x00FF00);
      expect(packed[2]).toBe(0x0000FF);
    });

    it("should mask to 24 bits", () => {
      const colors = [0xFFFFFFFF];
      const packed = packPalette(colors);
      expect(packed[0]).toBe(0xFFFFFF);
    });

    it("should handle empty palette", () => {
      const packed = packPalette([]);
      expect(packed.length).toBe(0);
    });
  });

  describe("sunDirFromAngles", () => {
    it("should point straight up at 90 degree elevation", () => {
      const dir = sunDirFromAngles(0, 90);
      expect(dir[0]).toBeCloseTo(0);
      expect(dir[1]).toBeCloseTo(1);
      expect(dir[2]).toBeCloseTo(0);
    });

    it("should point along +z at 0 elevation 0 azimuth", () => {
      const dir = sunDirFromAngles(0, 0);
      expect(dir[0]).toBeCloseTo(0);
      expect(dir[1]).toBeCloseTo(0);
      expect(dir[2]).toBeCloseTo(1);
    });

    it("should point along +x at 0 elevation 90 azimuth", () => {
      const dir = sunDirFromAngles(90, 0);
      expect(dir[0]).toBeCloseTo(1);
      expect(dir[1]).toBeCloseTo(0);
      expect(dir[2]).toBeCloseTo(0, 5);
    });
  });

  describe("buildUniformData", () => {
    const settings = { ...defaultRenderSettings };

    it("should produce correctly sized buffer", () => {
      const data = buildUniformData(
        [0, 5, 10],
        [0, 0, -1],
        [1, 0, 0],
        [0, 1, 0],
        1.0,
        1.5,
        800,
        600,
        { x: 32, y: 32, z: 32 },
        settings
      );
      expect(data.length).toBe(32);
      expect(data.byteLength).toBe(128);
    });

    it("should pack eye position at offset 0", () => {
      const data = buildUniformData(
        [1.5, 2.5, 3.5],
        [0, 0, -1],
        [1, 0, 0],
        [0, 1, 0],
        1.0,
        1.0,
        100,
        100,
        { x: 16, y: 16, z: 16 },
        settings
      );
      expect(data[0]).toBeCloseTo(1.5);
      expect(data[1]).toBeCloseTo(2.5);
      expect(data[2]).toBeCloseTo(3.5);
    });

    it("should pack fov at offset 3", () => {
      const fov = 1.2;
      const data = buildUniformData(
        [0, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0],
        fov, 1.0, 100, 100, { x: 8, y: 8, z: 8 }, settings
      );
      expect(data[3]).toBeCloseTo(fov);
    });

    it("should pack dimensions as u32", () => {
      const data = buildUniformData(
        [0, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0],
        1.0, 1.0, 100, 100, { x: 64, y: 32, z: 16 }, settings
      );
      const u32View = new Uint32Array(data.buffer);
      expect(u32View[16]).toBe(64);
      expect(u32View[17]).toBe(32);
      expect(u32View[18]).toBe(16);
    });

    it("should pack aspect ratio", () => {
      const data = buildUniformData(
        [0, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0],
        1.0, 1.777, 1920, 1080, { x: 8, y: 8, z: 8 }, settings
      );
      expect(data[7]).toBeCloseTo(1.777);
    });

    it("should pack width and height", () => {
      const data = buildUniformData(
        [0, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0],
        1.0, 1.0, 1920, 1080, { x: 8, y: 8, z: 8 }, settings
      );
      expect(data[11]).toBeCloseTo(1920);
      expect(data[15]).toBeCloseTo(1080);
    });

    it("should pack sun intensity at offset 23", () => {
      const customSettings = { ...settings, sunIntensity: 2.5 };
      const data = buildUniformData(
        [0, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0],
        1.0, 1.0, 100, 100, { x: 8, y: 8, z: 8 }, customSettings
      );
      expect(data[23]).toBeCloseTo(2.5);
    });

    it("should pack ambient intensity at offset 27", () => {
      const customSettings = { ...settings, ambientIntensity: 0.6 };
      const data = buildUniformData(
        [0, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0],
        1.0, 1.0, 100, 100, { x: 8, y: 8, z: 8 }, customSettings
      );
      expect(data[27]).toBeCloseTo(0.6);
    });

    it("should pack shadow darkness at offset 28", () => {
      const customSettings = { ...settings, shadowDarkness: 0.8 };
      const data = buildUniformData(
        [0, 0, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0],
        1.0, 1.0, 100, 100, { x: 8, y: 8, z: 8 }, customSettings
      );
      expect(data[28]).toBeCloseTo(0.8);
    });
  });
});
