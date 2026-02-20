import { describe, expect, it } from "vitest";
import { isInsideFillShape, isInsideFillShapePrecomputed, precomputeShapeParams } from "../fill-shape-utils";

describe("fill-shape-utils", () => {
  describe("Pyramid", () => {
    const bounds = {
      minX: 0,
      maxX: 10,
      minY: 0,
      maxY: 6,
      minZ: 0,
      maxZ: 6,
    };
    const centerX = Math.floor((bounds.minX + bounds.maxX) / 2);
    const centerZ = Math.floor((bounds.minZ + bounds.maxZ) / 2);

    const getInsetAtLevel = (
      y: number,
      axis: "x" | "z",
      isInside: (x: number, y: number, z: number) => boolean
    ): number => {
      if (axis === "x") {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
          if (isInside(x, y, centerZ)) return x - bounds.minX;
        }
      } else {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          if (isInside(centerX, y, z)) return z - bounds.minZ;
        }
      }
      throw new Error(`No pyramid blocks found at y=${y}`);
    };

    it("should keep x/z pyramid step levels aligned", () => {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const isInside = (x: number, currentY: number, z: number) =>
          isInsideFillShape("Pyramid", x, currentY, z, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ);
        expect(getInsetAtLevel(y, "x", isInside)).toBe(getInsetAtLevel(y, "z", isInside));
      }
    });

    it("should keep precomputed x/z pyramid step levels aligned", () => {
      const p = precomputeShapeParams(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ);
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const isInside = (x: number, currentY: number, z: number) =>
          isInsideFillShapePrecomputed("Pyramid", x, currentY, z, p);
        expect(getInsetAtLevel(y, "x", isInside)).toBe(getInsetAtLevel(y, "z", isInside));
      }
    });
  });
});
