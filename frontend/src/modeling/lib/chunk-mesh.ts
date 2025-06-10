import * as THREE from "three";
import { BlockRun, Chunk, PreviewVoxels } from "@/module_bindings";

type VoxelFaces = {
  color: string;
  gridPos: THREE.Vector3;
  faceIndexes: number[];
};

const faces = [
  {
    vertices: [
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
    ],
    normal: [1, 0, 0],
    offset: [1, 0, 0],
  },
  {
    vertices: [
      [-0.5, -0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
    ],
    normal: [-1, 0, 0],
    offset: [-1, 0, 0],
  },
  {
    vertices: [
      [-0.5, 0.5, -0.5],
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
    ],
    normal: [0, 1, 0],
    offset: [0, 1, 0],
  },
  {
    vertices: [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
      [-0.5, -0.5, 0.5],
    ],
    normal: [0, -1, 0],
    offset: [0, -1, 0],
  },
  {
    vertices: [
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ],
    normal: [0, 0, 1],
    offset: [0, 0, 1],
  },
  {
    vertices: [
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, -0.5, -0.5],
    ],
    normal: [0, 0, -1],
    offset: [0, 0, -1],
  },
];

const directions = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

export class ChunkMesh {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.MeshLambertMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = null;
    this.geometry = null;
    this.material = null;
  }

  decompressBlocks(blocks: BlockRun[]): (BlockRun | undefined)[][][] {
    const decompressed: (BlockRun | undefined)[][][] = [];
    for (const blockRun of blocks) {
      const { topLeft, bottomRight } = blockRun;
      for (let x = topLeft.x; x <= bottomRight.x; x++) {
        if (!decompressed[x]) decompressed[x] = [];
        for (let y = topLeft.y; y <= bottomRight.y; y++) {
          if (!decompressed[x][y]) decompressed[x][y] = [];
          for (let z = topLeft.z; z <= bottomRight.z; z++) {
            if (!decompressed[x][y][z]) {
              decompressed[x][y][z] = blockRun;
            }
          }
        }
      }
    }
    return decompressed;
  }

  update(newChunk: Chunk, previewVoxels?: PreviewVoxels | null) {
    const realBlocks = this.decompressBlocks(newChunk.blocks);
    const previewBlocks = previewVoxels
      ? this.decompressBlocks(previewVoxels.previewPositions)
      : null;

    const exteriorFaces = this.findExteriorFaces(realBlocks, previewBlocks, {
      xDim: newChunk.xDim,
      yDim: newChunk.yDim,
      zDim: newChunk.zDim,
    });
    this.updateMesh(exteriorFaces);
  }

  findExteriorFaces(
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (BlockRun | undefined)[][][] | null,
    dimensions: { xDim: number; yDim: number; zDim: number }
  ): Map<string, VoxelFaces> {
    const exteriorFaces: Map<string, VoxelFaces> = new Map();
    const visited: Set<string> = new Set();
    const queue: THREE.Vector3[] = [];

    const minX = -1;
    const maxX = dimensions.xDim;
    const minY = -1;
    const maxY = dimensions.yDim;
    const minZ = -1;
    const maxZ = dimensions.zDim;

    const isInVoxelBounds = (x: number, y: number, z: number): boolean => {
      return (
        x >= 0 &&
        x < dimensions.xDim &&
        y >= 0 &&
        y < dimensions.yDim &&
        z >= 0 &&
        z < dimensions.zDim
      );
    };

    const isInExplorationBounds = (
      x: number,
      y: number,
      z: number
    ): boolean => {
      return (
        x >= minX &&
        x <= maxX &&
        y >= minY &&
        y <= maxY &&
        z >= minZ &&
        z <= maxZ
      );
    };

    const isAir = (x: number, y: number, z: number): boolean => {
      return !isInVoxelBounds(x, y, z) || !realBlocks[x]?.[y]?.[z];
    };

    const getBlock = (
      x: number,
      y: number,
      z: number
    ): BlockRun | undefined => {
      if (!isInVoxelBounds(x, y, z)) return undefined;
      return realBlocks[x]?.[y]?.[z];
    };

    const startX = -1;
    const startY = 0;
    const startZ = 0;

    queue.push(new THREE.Vector3(startX, startY, startZ));
    visited.add(`${startX},${startY},${startZ}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const { x, y, z } = current;

      for (let dirIndex = 0; dirIndex < directions.length; dirIndex++) {
        const dir = directions[dirIndex];
        const nx = x + dir.x;
        const ny = y + dir.y;
        const nz = z + dir.z;
        const key = `${nx},${ny},${nz}`;

        if (
          !visited.has(key) &&
          isInExplorationBounds(nx, ny, nz) &&
          isAir(nx, ny, nz)
        ) {
          visited.add(key);
          queue.push(new THREE.Vector3(nx, ny, nz));
        }

        if (!isAir(nx, ny, nz)) {
          const block = getBlock(nx, ny, nz);
          const blockColor = block?.color ? block.color : "#ffffff";

          if (!exteriorFaces.has(key)) {
            exteriorFaces.set(key, {
              color: blockColor,
              faceIndexes: [],
              gridPos: new THREE.Vector3(nx, ny, nz),
            });
          }

          const oppositeDirIndex =
            dirIndex % 2 === 0 ? dirIndex + 1 : dirIndex - 1;
          exteriorFaces.get(key)!.faceIndexes.push(oppositeDirIndex);
        }
      }
    }

    return exteriorFaces;
  }

  private updateMesh(exteriorFaces: Map<string, VoxelFaces>): void {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    let vertexIndex = 0;

    exteriorFaces.forEach((voxelFace) => {
      const { color, gridPos, faceIndexes } = voxelFace;

      const colorObj = new THREE.Color(color);
      const r = colorObj.r;
      const g = colorObj.g;
      const b = colorObj.b;

      faceIndexes.forEach((faceIndex) => {
        const face = faces[faceIndex];
        const faceVertices = face.vertices;
        const faceNormal = face.normal;

        const startVertexIndex = vertexIndex;

        faceVertices.forEach((vertex) => {
          vertices.push(
            vertex[0] + gridPos.x + 0.5,
            vertex[1] + gridPos.y + 0.5,
            vertex[2] + gridPos.z + 0.5
          );

          normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);
          colors.push(r, g, b);
          vertexIndex++;
        });

        indices.push(
          startVertexIndex,
          startVertexIndex + 1,
          startVertexIndex + 2
        );

        indices.push(
          startVertexIndex,
          startVertexIndex + 2,
          startVertexIndex + 3
        );
      });
    });

    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.FrontSide,
      });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
    }

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    this.geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    this.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );
    this.geometry.setIndex(indices);

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    if (this.geometry.index) {
      this.geometry.index.needsUpdate = true;
    }

    this.geometry.computeBoundingSphere();
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);

      if (this.geometry) {
        this.geometry.dispose();
        this.geometry = null;
      }

      if (this.material) {
        this.material.dispose();
        this.material = null;
      }

      this.mesh = null;
    }
  }
}
