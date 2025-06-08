import * as THREE from "three";
import { BlockRun, Chunk, PreviewVoxels } from "@/module_bindings";

type VoxelDetails = { color: string | undefined; transparant: boolean };

export class ChunkMesh {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = null;
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
    const voxels = this.parseRuns(newChunk, previewVoxels);
    this.computeHull(voxels);
  }

  parseRuns: (
    chunk: Chunk,
    previewVoxels?: PreviewVoxels | null
  ) => (VoxelDetails | undefined)[][][] = (chunk, previewVoxels) => {
    const voxels: (VoxelDetails | undefined)[][][] = [];

    const targetBlocks = this.decompressBlocks(chunk.blocks);
    const previewBlocks = previewVoxels
      ? this.decompressBlocks(previewVoxels.previewPositions)
      : null;

    for (let x = 0; x < chunk.xDim; x++) {
      if (!voxels[x]) voxels[x] = [];
      for (let y = 0; y < chunk.yDim; y++) {
        if (!voxels[x][y]) voxels[x][y] = [];
        for (let z = 0; z < chunk.zDim; z++) {
          const blockRun = targetBlocks[x]?.[y]?.[z];
          const previewBlockRun = previewBlocks
            ? previewBlocks[x]?.[y]?.[z]
            : null;
          if (previewBlockRun) {
            if (previewVoxels?.isAddMode) {
              voxels[x][y][z] = {
                color: previewBlockRun.color,
                transparant: false,
              };
            } else {
              voxels[x][y][z] = {
                color: blockRun ? blockRun.color : previewBlockRun.color,
                transparant: true,
              };
            }
          } else if (blockRun) {
            voxels[x][y][z] = {
              color: blockRun.color,
              transparant: false,
            };
          }
        }
      }
    }

    return voxels;
  };

  computeHull: (voxels: (VoxelDetails | undefined)[][][]) => void = (
    voxels
  ) => {
    const exteriorVoxels = this.findExteriorVoxels(voxels);
    const color = "#FF0000";
    const mesh = this.createMesh(exteriorVoxels, color);
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
    this.mesh = mesh;
    this.scene.add(mesh);
  };

  findExteriorVoxels(
    voxels: (VoxelDetails | undefined)[][][]
  ): THREE.Vector3[] {
    const exterior: THREE.Vector3[] = [];
    const visited: Set<string> = new Set();
    const queue: THREE.Vector3[] = [];
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    const minX = -1;
    const maxX = voxels.length;
    const minY = -1;
    const maxY = voxels[0]?.length || 0;
    const minZ = -1;
    const maxZ = voxels[0]?.[0]?.length || 0;

    const isInVoxelBounds = (x: number, y: number, z: number): boolean => {
      return (
        x >= 0 &&
        x < voxels.length &&
        y >= 0 &&
        y < voxels[x]?.length &&
        z >= 0 &&
        z < voxels[x]?.[y]?.length
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
      return !isInVoxelBounds(x, y, z) || !voxels[x][y][z];
    };

    const startX = -1;
    const startY = 0;
    const startZ = 0;

    queue.push(new THREE.Vector3(startX, startY, startZ));
    visited.add(`${startX},${startY},${startZ}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const { x, y, z } = current;

      for (const dir of directions) {
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
      }
    }

    for (let x = 0; x < voxels.length; x++) {
      for (let y = 0; y < voxels[x].length; y++) {
        for (let z = 0; z < voxels[x][y].length; z++) {
          if (voxels[x][y][z]) {
            for (const dir of directions) {
              const nx = x + dir.x;
              const ny = y + dir.y;
              const nz = z + dir.z;
              const neighborKey = `${nx},${ny},${nz}`;

              if (visited.has(neighborKey)) {
                exterior.push(new THREE.Vector3(x, y, z));
                break;
              }
            }
          }
        }
      }
    }

    return exterior;
  }

  createMesh(exteriorVoxels: THREE.Vector3[], color: string): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    let vertexIndex = 0;

    // Convert exterior voxels to a Set for fast lookup
    const voxelSet = new Set(exteriorVoxels.map((v) => `${v.x},${v.y},${v.z}`));

    // Face definitions: [vertices, normal, direction offset]
    const faces = [
      {
        vertices: [
          [-0.5, -0.5, -0.5],
          [0.5, -0.5, -0.5],
          [0.5, 0.5, -0.5],
          [-0.5, 0.5, -0.5],
        ],
        normal: [0, 0, -1],
        offset: [0, 0, -1],
      }, // back
      {
        vertices: [
          [-0.5, -0.5, 0.5],
          [-0.5, 0.5, 0.5],
          [0.5, 0.5, 0.5],
          [0.5, -0.5, 0.5],
        ],
        normal: [0, 0, 1],
        offset: [0, 0, 1],
      }, // front
      {
        vertices: [
          [-0.5, -0.5, -0.5],
          [-0.5, -0.5, 0.5],
          [0.5, -0.5, 0.5],
          [0.5, -0.5, -0.5],
        ],
        normal: [0, -1, 0],
        offset: [0, -1, 0],
      }, // bottom
      {
        vertices: [
          [-0.5, 0.5, -0.5],
          [0.5, 0.5, -0.5],
          [0.5, 0.5, 0.5],
          [-0.5, 0.5, 0.5],
        ],
        normal: [0, 1, 0],
        offset: [0, 1, 0],
      }, // top
      {
        vertices: [
          [-0.5, -0.5, -0.5],
          [-0.5, 0.5, -0.5],
          [-0.5, 0.5, 0.5],
          [-0.5, -0.5, 0.5],
        ],
        normal: [-1, 0, 0],
        offset: [-1, 0, 0],
      }, // left
      {
        vertices: [
          [0.5, -0.5, -0.5],
          [0.5, -0.5, 0.5],
          [0.5, 0.5, 0.5],
          [0.5, 0.5, -0.5],
        ],
        normal: [1, 0, 0],
        offset: [1, 0, 0],
      }, // right
    ];

    for (const voxel of exteriorVoxels) {
      for (const face of faces) {
        // Check if there's an adjacent voxel in this face's direction
        const adjacentX = voxel.x + face.offset[0];
        const adjacentY = voxel.y + face.offset[1];
        const adjacentZ = voxel.z + face.offset[2];
        const adjacentKey = `${adjacentX},${adjacentY},${adjacentZ}`;

        // Only render this face if there's no adjacent voxel (face is exposed)
        if (!voxelSet.has(adjacentKey)) {
          const startIndex = vertexIndex;

          // Add the 4 vertices for this face
          for (const vertex of face.vertices) {
            positions.push(
              voxel.x + vertex[0],
              voxel.y + vertex[1],
              voxel.z + vertex[2]
            );
            normals.push(face.normal[0], face.normal[1], face.normal[2]);
          }

          // Add indices for the two triangles that make up this face
          indices.push(
            startIndex,
            startIndex + 1,
            startIndex + 2,
            startIndex,
            startIndex + 2,
            startIndex + 3
          );

          vertexIndex += 4;
        }
      }
    }

    // Set geometry attributes
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    geometry.setIndex(indices);

    // Optional: compute bounding sphere/box for better culling
    geometry.computeBoundingSphere();

    // Create material with single color
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.5,
    });

    return new THREE.Mesh(geometry, material);
  }

  // For even better performance, you might want to separate this into islands:
  findVoxelIslands(
    voxels: (VoxelDetails | undefined)[][][]
  ): THREE.Vector3[][] {
    const visited = new Set<string>();
    const islands: THREE.Vector3[][] = [];

    const directions = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    for (let x = 0; x < voxels.length; x++) {
      for (let y = 0; y < voxels[x]?.length || 0; y++) {
        for (let z = 0; z < voxels[x]?.[y]?.length || 0; z++) {
          const key = `${x},${y},${z}`;
          if (voxels[x]?.[y]?.[z] && !visited.has(key)) {
            // Start a new island
            const island: THREE.Vector3[] = [];
            const queue: THREE.Vector3[] = [new THREE.Vector3(x, y, z)];
            visited.add(key);

            while (queue.length > 0) {
              const current = queue.shift()!;
              island.push(current);

              // Check all 6 directions
              for (const [dx, dy, dz] of directions) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                const nz = current.z + dz;
                const neighborKey = `${nx},${ny},${nz}`;

                if (
                  nx >= 0 &&
                  nx < voxels.length &&
                  ny >= 0 &&
                  ny < (voxels[nx]?.length || 0) &&
                  nz >= 0 &&
                  nz < (voxels[nx]?.[ny]?.length || 0) &&
                  voxels[nx]?.[ny]?.[nz] &&
                  !visited.has(neighborKey)
                ) {
                  visited.add(neighborKey);
                  queue.push(new THREE.Vector3(nx, ny, nz));
                }
              }
            }

            islands.push(island);
          }
        }
      }
    }

    return islands;
  }

  dispose() {}
}
