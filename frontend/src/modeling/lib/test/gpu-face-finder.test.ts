import { describe, it, expect, beforeEach } from "vitest";
import { ExteriorFacesFinder } from "../find-exterior-faces";
import { MeshArrays } from "../mesh-arrays";
import { VoxelFrame } from "../voxel-frame";
import { createVoxelData, setVoxel } from "./test-helpers";
import type { Vector3 } from "@/state/types";
import { calculateAmbientOcclusion } from "../ambient-occlusion";

function createBlockAtlasMapping(numBlocks: number): number[] {
  const mapping: number[] = [];
  for (let i = 0; i < numBlocks; i++) {
    mapping.push(i);
  }
  return mapping;
}

function buildGPUFaceData(
  voxelData: Uint8Array,
  selectionData: Uint8Array,
  selectionEmpty: boolean,
  blockAtlasMapping: number[],
  dimensions: Vector3
): Uint32Array {
  const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
  const output = new Uint32Array(totalVoxels * 6 * 4);
  const strideX = dimensions.y * dimensions.z;

  const FACE_DIRS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  for (let x = 0; x < dimensions.x; x++) {
    for (let y = 0; y < dimensions.y; y++) {
      for (let z = 0; z < dimensions.z; z++) {
        const voxelIdx = x * strideX + y * dimensions.z + z;
        const blockValue = voxelData[voxelIdx];
        const blockType = blockValue & 0x7f;
        const blockVisible = blockType !== 0;
        const blockIsSelected =
          !selectionEmpty && selectionData[voxelIdx] !== 0;

        if (!blockVisible && !blockIsSelected) continue;

        for (let f = 0; f < 6; f++) {
          const [dx, dy, dz] = FACE_DIRS[f];
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;
          const outIdx = (voxelIdx * 6 + f) * 4;

          const neighborInBounds =
            nx >= 0 &&
            nx < dimensions.x &&
            ny >= 0 &&
            ny < dimensions.y &&
            nz >= 0 &&
            nz < dimensions.z;

          if (blockIsSelected && !blockVisible) {
            const neighborIsSelected =
              neighborInBounds &&
              selectionData[nx * strideX + ny * dimensions.z + nz] !== 0;
            if (!neighborIsSelected) {
              const selBlockType = selectionData[voxelIdx] & 0x7f;
              const texIdx =
                blockAtlasMapping[Math.max(selBlockType, 1) - 1];
              const ao = calculateAmbientOcclusion(
                nx, ny, nz, f, voxelData,
                dimensions.x, dimensions.y, dimensions.z, strideX
              );
              output[outIdx] = 1;
              output[outIdx + 1] = texIdx;
              output[outIdx + 2] = ao;
              output[outIdx + 3] = 1;
            }
          } else if (blockVisible) {
            const neighborVisible =
              neighborInBounds &&
              (voxelData[nx * strideX + ny * dimensions.z + nz] & 0x7f) !== 0;
            if (!neighborVisible) {
              const texIdx = blockAtlasMapping[blockType - 1];
              const ao = calculateAmbientOcclusion(
                nx, ny, nz, f, voxelData,
                dimensions.x, dimensions.y, dimensions.z, strideX
              );
              output[outIdx] = 1;
              output[outIdx + 1] = texIdx;
              output[outIdx + 2] = ao;
              output[outIdx + 3] = blockIsSelected ? 1 : 0;
            }
          }
        }
      }
    }
  }

  return output;
}

describe("GPU face finder (CPU reference simulation)", () => {
  let finder: ExteriorFacesFinder;

  beforeEach(() => {
    finder = new ExteriorFacesFinder(64);
  });

  function runBothPaths(
    voxelData: Uint8Array,
    dimensions: Vector3,
    blockAtlasMapping: number[],
    selectionFrame: VoxelFrame,
    textureWidth: number = 4
  ) {
    const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;

    const cpuMesh = new MeshArrays(maxFaces * 4, maxFaces * 6);
    finder.findExteriorFaces(
      voxelData,
      textureWidth,
      blockAtlasMapping,
      dimensions,
      cpuMesh,
      selectionFrame
    );

    const gpuData = buildGPUFaceData(
      voxelData,
      selectionFrame.getData(),
      selectionFrame.isEmpty(),
      blockAtlasMapping,
      dimensions
    );

    const gpuMesh = new MeshArrays(maxFaces * 4, maxFaces * 6);
    (finder as any).buildMeshFromGPUData(
      gpuData,
      textureWidth,
      dimensions,
      gpuMesh
    );

    return { cpuMesh, gpuMesh };
  }

  it("should produce identical output for a single block", () => {
    const dimensions: Vector3 = { x: 1, y: 1, z: 1 };
    const voxelData = createVoxelData(dimensions);
    setVoxel(voxelData, 0, 0, 0, 1, dimensions);
    const selectionFrame = new VoxelFrame(dimensions);

    const { cpuMesh, gpuMesh } = runBothPaths(
      voxelData,
      dimensions,
      createBlockAtlasMapping(2),
      selectionFrame
    );

    expect(gpuMesh.indexCount).toBe(cpuMesh.indexCount);
    expect(gpuMesh.vertexCount).toBe(cpuMesh.vertexCount);
    expect(Array.from(gpuMesh.getVertices())).toEqual(
      Array.from(cpuMesh.getVertices())
    );
    expect(Array.from(gpuMesh.getNormals())).toEqual(
      Array.from(cpuMesh.getNormals())
    );
    expect(Array.from(gpuMesh.getUVs())).toEqual(
      Array.from(cpuMesh.getUVs())
    );
    expect(Array.from(gpuMesh.getAO())).toEqual(
      Array.from(cpuMesh.getAO())
    );
    expect(Array.from(gpuMesh.getIndices())).toEqual(
      Array.from(cpuMesh.getIndices())
    );
  });

  it("should produce identical output for a 2x2x2 cube", () => {
    const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
    const voxelData = createVoxelData(dimensions);
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++)
        for (let z = 0; z < 2; z++)
          setVoxel(voxelData, x, y, z, 1, dimensions);
    const selectionFrame = new VoxelFrame(dimensions);

    const { cpuMesh, gpuMesh } = runBothPaths(
      voxelData,
      dimensions,
      createBlockAtlasMapping(2),
      selectionFrame
    );

    expect(gpuMesh.indexCount).toBe(cpuMesh.indexCount);
    expect(gpuMesh.vertexCount).toBe(cpuMesh.vertexCount);
    expect(Array.from(gpuMesh.getVertices())).toEqual(
      Array.from(cpuMesh.getVertices())
    );
  });

  it("should produce identical output for two blocks with different types", () => {
    const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
    const voxelData = createVoxelData(dimensions);
    setVoxel(voxelData, 0, 0, 0, 1, dimensions);
    setVoxel(voxelData, 1, 0, 0, 2, dimensions);
    const selectionFrame = new VoxelFrame(dimensions);

    const { cpuMesh, gpuMesh } = runBothPaths(
      voxelData,
      dimensions,
      createBlockAtlasMapping(3),
      selectionFrame
    );

    expect(gpuMesh.indexCount).toBe(cpuMesh.indexCount);
    expect(gpuMesh.vertexCount).toBe(cpuMesh.vertexCount);
    expect(Array.from(gpuMesh.getVertices())).toEqual(
      Array.from(cpuMesh.getVertices())
    );
    expect(Array.from(gpuMesh.getAO())).toEqual(
      Array.from(cpuMesh.getAO())
    );
  });

  it("should produce identical output for selection-only faces", () => {
    const dimensions: Vector3 = { x: 2, y: 1, z: 1 };
    const voxelData = createVoxelData(dimensions);
    const selectionFrame = new VoxelFrame(dimensions);
    selectionFrame.set(0, 0, 0, 1);

    const { cpuMesh, gpuMesh } = runBothPaths(
      voxelData,
      dimensions,
      createBlockAtlasMapping(2),
      selectionFrame
    );

    expect(gpuMesh.indexCount).toBe(cpuMesh.indexCount);
    expect(gpuMesh.vertexCount).toBe(cpuMesh.vertexCount);
    expect(Array.from(gpuMesh.getIsSelected())).toEqual(
      Array.from(cpuMesh.getIsSelected())
    );
  });

  it("should produce identical output for empty voxel data", () => {
    const dimensions: Vector3 = { x: 2, y: 2, z: 2 };
    const voxelData = createVoxelData(dimensions);
    const selectionFrame = new VoxelFrame(dimensions);

    const { cpuMesh, gpuMesh } = runBothPaths(
      voxelData,
      dimensions,
      createBlockAtlasMapping(2),
      selectionFrame
    );

    expect(gpuMesh.indexCount).toBe(0);
    expect(gpuMesh.vertexCount).toBe(0);
    expect(gpuMesh.indexCount).toBe(cpuMesh.indexCount);
    expect(gpuMesh.vertexCount).toBe(cpuMesh.vertexCount);
  });

  it("should produce identical output for a 3x3x3 cube with a hole", () => {
    const dimensions: Vector3 = { x: 3, y: 3, z: 3 };
    const voxelData = createVoxelData(dimensions);
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++) {
          const isOnSurface =
            x === 0 || x === 2 || y === 0 || y === 2 || z === 0 || z === 2;
          const isHole = z === 0 && x === 1 && y === 1;
          if (isOnSurface && !isHole)
            setVoxel(voxelData, x, y, z, 1, dimensions);
        }
    const selectionFrame = new VoxelFrame(dimensions);

    const { cpuMesh, gpuMesh } = runBothPaths(
      voxelData,
      dimensions,
      createBlockAtlasMapping(2),
      selectionFrame
    );

    expect(gpuMesh.indexCount).toBe(cpuMesh.indexCount);
    expect(gpuMesh.vertexCount).toBe(cpuMesh.vertexCount);
    expect(Array.from(gpuMesh.getVertices())).toEqual(
      Array.from(cpuMesh.getVertices())
    );
    expect(Array.from(gpuMesh.getNormals())).toEqual(
      Array.from(cpuMesh.getNormals())
    );
  });

  it("should produce identical output for 8x8x8 solid cube", () => {
    const dimensions: Vector3 = { x: 8, y: 8, z: 8 };
    const voxelData = createVoxelData(dimensions);
    for (let x = 0; x < 8; x++)
      for (let y = 0; y < 8; y++)
        for (let z = 0; z < 8; z++)
          setVoxel(voxelData, x, y, z, 1, dimensions);
    const selectionFrame = new VoxelFrame(dimensions);

    const { cpuMesh, gpuMesh } = runBothPaths(
      voxelData,
      dimensions,
      createBlockAtlasMapping(2),
      selectionFrame
    );

    expect(gpuMesh.indexCount).toBe(cpuMesh.indexCount);
    expect(gpuMesh.vertexCount).toBe(cpuMesh.vertexCount);
    expect(Array.from(gpuMesh.getVertices())).toEqual(
      Array.from(cpuMesh.getVertices())
    );
  });

  it("findExteriorFacesGPU should fall back when GPU not available", async () => {
    const dimensions: Vector3 = { x: 1, y: 1, z: 1 };
    const voxelData = createVoxelData(dimensions);
    setVoxel(voxelData, 0, 0, 0, 1, dimensions);
    const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
    const meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);
    const selectionFrame = new VoxelFrame(dimensions);

    const result = await finder.findExteriorFacesGPU(
      voxelData,
      4,
      createBlockAtlasMapping(2),
      dimensions,
      meshArrays,
      selectionFrame
    );

    expect(result).toBe(false);
  });
});
