import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { performRaycast } from "../voxel-raycast";
import { setRaycastable } from "../voxel-data-utils";

describe("voxel-raycast", () => {
  const dimensions = { x: 16, y: 16, z: 16 };

  const createVoxelGrid = () => {
    const grid: number[][][] = [];
    for (let x = 0; x < dimensions.x; x++) {
      grid[x] = [];
      for (let y = 0; y < dimensions.y; y++) {
        grid[x][y] = [];
        for (let z = 0; z < dimensions.z; z++) {
          grid[x][y][z] = 0;
        }
      }
    }
    return grid;
  };

  const getVoxel = (
    grid: number[][][]
  ): ((x: number, y: number, z: number) => number) => {
    return (x: number, y: number, z: number) => {
      if (
        x >= 0 &&
        x < dimensions.x &&
        y >= 0 &&
        y < dimensions.y &&
        z >= 0 &&
        z < dimensions.z
      ) {
        return grid[x][y][z];
      }
      return 0;
    };
  };

  describe("performRaycast", () => {
    it("should return null when ray misses all voxels", () => {
      const grid = createVoxelGrid();
      const origin = new THREE.Vector3(-5, 8, 8);
      const direction = new THREE.Vector3(-1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );
      expect(result).toBeNull();
    });

    it("should hit a raycastable voxel along positive x axis", () => {
      const grid = createVoxelGrid();
      grid[5][8][8] = setRaycastable(1);

      const origin = new THREE.Vector3(-1, 8.5, 8.5);
      const direction = new THREE.Vector3(1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(5);
      expect(result!.gridPosition.y).toBe(8);
      expect(result!.gridPosition.z).toBe(8);
      expect(result!.normal.x).toBe(-1);
      expect(result!.normal.y).toBe(0);
      expect(result!.normal.z).toBe(0);
    });

    it("should hit a raycastable voxel along negative x axis", () => {
      const grid = createVoxelGrid();
      grid[5][8][8] = setRaycastable(2);

      const origin = new THREE.Vector3(20, 8.5, 8.5);
      const direction = new THREE.Vector3(-1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(5);
      expect(result!.gridPosition.y).toBe(8);
      expect(result!.gridPosition.z).toBe(8);
      expect(result!.normal.x).toBe(1);
      expect(result!.normal.y).toBe(0);
      expect(result!.normal.z).toBe(0);
    });

    it("should hit a raycastable voxel along positive y axis", () => {
      const grid = createVoxelGrid();
      grid[8][5][8] = setRaycastable(1);

      const origin = new THREE.Vector3(8.5, -1, 8.5);
      const direction = new THREE.Vector3(0, 1, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(8);
      expect(result!.gridPosition.y).toBe(5);
      expect(result!.gridPosition.z).toBe(8);
      expect(result!.normal.x).toBe(0);
      expect(result!.normal.y).toBe(-1);
      expect(result!.normal.z).toBe(0);
    });

    it("should hit a raycastable voxel along positive z axis", () => {
      const grid = createVoxelGrid();
      grid[8][8][5] = setRaycastable(1);

      const origin = new THREE.Vector3(8.5, 8.5, -1);
      const direction = new THREE.Vector3(0, 0, 1);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(8);
      expect(result!.gridPosition.y).toBe(8);
      expect(result!.gridPosition.z).toBe(5);
      expect(result!.normal.x).toBe(0);
      expect(result!.normal.y).toBe(0);
      expect(result!.normal.z).toBe(-1);
    });

    it("should NOT hit a voxel without raycastable bit set, but should hit boundary", () => {
      const grid = createVoxelGrid();
      grid[5][8][8] = 1;

      const origin = new THREE.Vector3(-1, 8.5, 8.5);
      const direction = new THREE.Vector3(1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(15);
      expect(result!.gridPosition.y).toBe(8);
      expect(result!.gridPosition.z).toBe(8);
      expect(result!.normal.x).toBe(-1);
      expect(result!.blockValue).toBe(0x80);
    });

    it("should hit the first raycastable voxel when multiple are in path", () => {
      const grid = createVoxelGrid();
      grid[3][8][8] = setRaycastable(1);
      grid[5][8][8] = setRaycastable(2);
      grid[7][8][8] = setRaycastable(3);

      const origin = new THREE.Vector3(-1, 8.5, 8.5);
      const direction = new THREE.Vector3(1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(3);
      expect(result!.blockValue).toBe(setRaycastable(1));
    });

    it("should hit voxel with diagonal ray", () => {
      const grid = createVoxelGrid();
      grid[8][8][8] = setRaycastable(1);

      const origin = new THREE.Vector3(0, 0, 0);
      const direction = new THREE.Vector3(1, 1, 1).normalize();

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(8);
      expect(result!.gridPosition.y).toBe(8);
      expect(result!.gridPosition.z).toBe(8);
    });

    it("should return correct grid position and normal for voxel face", () => {
      const grid = createVoxelGrid();
      grid[5][8][8] = setRaycastable(1);

      const origin = new THREE.Vector3(-1, 8.5, 8.5);
      const direction = new THREE.Vector3(1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(5);
      expect(result!.gridPosition.y).toBe(8);
      expect(result!.gridPosition.z).toBe(8);
      expect(result!.normal.x).toBe(-1);
      expect(result!.normal.y).toBe(0);
      expect(result!.normal.z).toBe(0);
    });

    it("should handle ray starting inside bounds", () => {
      const grid = createVoxelGrid();
      grid[10][8][8] = setRaycastable(1);

      const origin = new THREE.Vector3(5.5, 8.5, 8.5);
      const direction = new THREE.Vector3(1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid)
      );

      expect(result).not.toBeNull();
      expect(result!.gridPosition.x).toBe(10);
    });

    it("should respect max distance", () => {
      const grid = createVoxelGrid();
      grid[15][8][8] = setRaycastable(1);

      const origin = new THREE.Vector3(-100, 8.5, 8.5);
      const direction = new THREE.Vector3(1, 0, 0);

      const result = performRaycast(
        origin,
        direction,
        dimensions,
        getVoxel(grid),
        50
      );

      expect(result).toBeNull();
    });
  });
});
