import * as THREE from "three";
import { BlockRun, Chunk, PreviewVoxels } from "@/module_bindings";

type VoxelDetails = { color: string | undefined; transparant: boolean };
type VoxelFaces = {
  color: string;
  gridPos: THREE.Vector3;
  faceIndexes: number[];
};

// Face definitions: [vertices, normal, direction offset]
const faces = [
  {
    vertices: [
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
    ],
    normal: [1, 0, 0],
    offset: [1, 0, 0],
  }, // right (+x)
  {
    vertices: [
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, -0.5, 0.5],
    ],
    normal: [-1, 0, 0],
    offset: [-1, 0, 0],
  }, // left (-x)
  {
    vertices: [
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ],
    normal: [0, 1, 0],
    offset: [0, 1, 0],
  }, // top (+y)
  {
    vertices: [
      [-0.5, -0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, -0.5, -0.5],
    ],
    normal: [0, -1, 0],
    offset: [0, -1, 0],
  }, // bottom (-y)
  {
    vertices: [
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, -0.5, 0.5],
    ],
    normal: [0, 0, 1],
    offset: [0, 0, 1],
  }, // front (+z)
  {
    vertices: [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5],
    ],
    normal: [0, 0, -1],
    offset: [0, 0, -1],
  }, // back (-z)
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
        for (let z = topLeft.z; z <= bottomRight.z; z++) {
          if (!decompressed[x][z]) decompressed[x][z] = [];
          for (let y = topLeft.y; y <= bottomRight.y; y++) {
            if (!decompressed[x][z][y]) {
              decompressed[x][z][y] = blockRun;
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

    const exteriorFaces = this.findExteriorFaces(realBlocks, previewBlocks);
    this.createMesh(exteriorFaces);
  }

  findExteriorFaces(
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (BlockRun | undefined)[][][] | null
  ): Map<string, VoxelFaces> {
    const exteriorFaces: Map<string, VoxelFaces> = new Map();
    const visited: Set<string> = new Set();
    const queue: THREE.Vector3[] = [];

    const minX = -1;
    const maxX = realBlocks.length;
    const minY = -1;
    const maxY = realBlocks[0]?.length || 0;
    const minZ = -1;
    const maxZ = realBlocks[0]?.[0]?.length || 0;

    const isInVoxelBounds = (x: number, y: number, z: number): boolean => {
      return (
        x >= 0 &&
        x < realBlocks.length &&
        y >= 0 &&
        y < realBlocks[x]?.length &&
        z >= 0 &&
        z < realBlocks[x]?.[y]?.length
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
      return !isInVoxelBounds(x, y, z) || !realBlocks[x][y][z];
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
          if (!exteriorFaces.has(key)) {
            exteriorFaces.set(key, {
              color: "#ffffff",
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

  createMesh(exteriorFaces: Map<string, VoxelFaces>): THREE.Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    let vertexIndex = 0;

    // Process each voxel's exterior faces
    exteriorFaces.forEach((voxelFace, key) => {
      const { color, gridPos, faceIndexes } = voxelFace;

      // Convert color string to RGB values (0-1 range)
      const colorObj = new THREE.Color(color);
      const r = colorObj.r;
      const g = colorObj.g;
      const b = colorObj.b;

      // Process each face of this voxel that should be rendered
      faceIndexes.forEach((faceIndex) => {
        const face = faces[faceIndex];
        const faceVertices = face.vertices;
        const faceNormal = face.normal;

        // Add the 4 vertices for this face (quad)
        const startVertexIndex = vertexIndex;

        faceVertices.forEach((vertex) => {
          // Transform vertex from local voxel space to world space
          vertices.push(
            vertex[0] + gridPos.x,
            vertex[1] + gridPos.y,
            vertex[2] + gridPos.z
          );

          // Add normal for this vertex
          normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);

          // Add color for this vertex
          colors.push(r, g, b);

          vertexIndex++;
        });

        // Create two triangles from the quad (face)
        // Triangle 1: vertices 0, 1, 2
        indices.push(
          startVertexIndex,
          startVertexIndex + 1,
          startVertexIndex + 2
        );

        // Triangle 2: vertices 0, 2, 3
        indices.push(
          startVertexIndex,
          startVertexIndex + 2,
          startVertexIndex + 3
        );
      });
    });

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();

    // Set attributes
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    // Compute bounding sphere for frustum culling
    geometry.computeBoundingSphere();

    // Create material that uses vertex colors
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
    });

    // Create and return the mesh
    const mesh = new THREE.Mesh(geometry, material);

    // Remove old mesh if it exists
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach((mat) => mat.dispose());
      } else {
        this.mesh.material.dispose();
      }
    }

    // Add new mesh to scene and store reference
    this.scene.add(mesh);
    this.mesh = mesh;

    return mesh;
  }

  dispose() {}
}
