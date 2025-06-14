import * as THREE from "three";
import {
  BlockModificationMode,
  BlockRun,
  Chunk,
  MeshType,
} from "@/module_bindings";

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

// Pre-computed AO lookup tables for each face direction
// Each face has 4 vertices, each vertex checks 3 neighbor positions: [side1, side2, corner]
// The corner is the diagonal neighbor that connects the two sides
const AO_LOOKUP = {
  // +X face (face index 0) - vertices: [0.5,-0.5,-0.5], [0.5,0.5,-0.5], [0.5,0.5,0.5], [0.5,-0.5,0.5]
  0: [
    [
      [1, -1, 0],
      [1, 0, -1],
      [1, -1, -1],
    ], // vertex 0: bottom-back
    [
      [1, 1, 0],
      [1, 0, -1],
      [1, 1, -1],
    ], // vertex 1: top-back
    [
      [1, 1, 0],
      [1, 0, 1],
      [1, 1, 1],
    ], // vertex 2: top-front
    [
      [1, -1, 0],
      [1, 0, 1],
      [1, -1, 1],
    ], // vertex 3: bottom-front
  ],
  // -X face (face index 1) - vertices: [-0.5,-0.5,-0.5], [-0.5,-0.5,0.5], [-0.5,0.5,0.5], [-0.5,0.5,-0.5]
  1: [
    [
      [-1, -1, 0],
      [-1, 0, -1],
      [-1, -1, -1],
    ], // vertex 0: bottom-back
    [
      [-1, -1, 0],
      [-1, 0, 1],
      [-1, -1, 1],
    ], // vertex 1: bottom-front
    [
      [-1, 1, 0],
      [-1, 0, 1],
      [-1, 1, 1],
    ], // vertex 2: top-front
    [
      [-1, 1, 0],
      [-1, 0, -1],
      [-1, 1, -1],
    ], // vertex 3: top-back
  ],
  // +Y face (face index 2) - vertices: [-0.5,0.5,-0.5], [-0.5,0.5,0.5], [0.5,0.5,0.5], [0.5,0.5,-0.5]
  2: [
    [
      [-1, 1, 0],
      [0, 1, -1],
      [-1, 1, -1],
    ], // vertex 0: left-back
    [
      [-1, 1, 0],
      [0, 1, 1],
      [-1, 1, 1],
    ], // vertex 1: left-front
    [
      [1, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
    ], // vertex 2: right-front
    [
      [1, 1, 0],
      [0, 1, -1],
      [1, 1, -1],
    ], // vertex 3: right-back
  ],
  // -Y face (face index 3) - vertices: [-0.5,-0.5,-0.5], [0.5,-0.5,-0.5], [0.5,-0.5,0.5], [-0.5,-0.5,0.5]
  3: [
    [
      [-1, -1, 0],
      [0, -1, -1],
      [-1, -1, -1],
    ], // vertex 0: left-back
    [
      [1, -1, 0],
      [0, -1, -1],
      [1, -1, -1],
    ], // vertex 1: right-back
    [
      [1, -1, 0],
      [0, -1, 1],
      [1, -1, 1],
    ], // vertex 2: right-front
    [
      [-1, -1, 0],
      [0, -1, 1],
      [-1, -1, 1],
    ], // vertex 3: left-front
  ],
  // +Z face (face index 4) - vertices: [-0.5,-0.5,0.5], [0.5,-0.5,0.5], [0.5,0.5,0.5], [-0.5,0.5,0.5]
  4: [
    [
      [-1, 0, 1],
      [0, -1, 1],
      [-1, -1, 1],
    ], // vertex 0: left-bottom
    [
      [1, 0, 1],
      [0, -1, 1],
      [1, -1, 1],
    ], // vertex 1: right-bottom
    [
      [1, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ], // vertex 2: right-top
    [
      [-1, 0, 1],
      [0, 1, 1],
      [-1, 1, 1],
    ], // vertex 3: left-top
  ],
  // -Z face (face index 5) - vertices: [-0.5,-0.5,-0.5], [-0.5,0.5,-0.5], [0.5,0.5,-0.5], [0.5,-0.5,-0.5]
  5: [
    [
      [-1, 0, -1],
      [0, -1, -1],
      [-1, -1, -1],
    ], // vertex 0: left-bottom
    [
      [-1, 0, -1],
      [0, 1, -1],
      [-1, 1, -1],
    ], // vertex 1: left-top
    [
      [1, 0, -1],
      [0, 1, -1],
      [1, 1, -1],
    ], // vertex 2: right-top
    [
      [1, 0, -1],
      [0, -1, -1],
      [1, -1, -1],
    ], // vertex 3: right-bottom
  ],
};

export class ChunkMesh {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.MeshLambertMaterial | null = null;
  private currentUpdateId: number = 0;

  // Cached solid block lookup for performance
  private solidBlockCache: Map<string, boolean> = new Map();
  private cacheVersion: number = 0;

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

  update(
    newChunk: Chunk,
    previewBlocks: (MeshType | undefined)[][][],
    buildMode: BlockModificationMode
  ): void {
    const updateId = ++this.currentUpdateId;

    try {
      // Decompress real blocks
      const realBlocks = this.decompressBlocks(newChunk.blocks);

      if (updateId !== this.currentUpdateId) {
        return;
      }

      // Clear cache for new update
      this.solidBlockCache.clear();
      this.cacheVersion++;

      // Find exterior faces
      const exteriorFaces = this.findExteriorFaces(
        realBlocks,
        previewBlocks,
        buildMode,
        {
          xDim: newChunk.xDim,
          yDim: newChunk.yDim,
          zDim: newChunk.zDim,
        }
      );

      if (updateId !== this.currentUpdateId) {
        return;
      }

      // Update mesh with ambient occlusion
      this.updateMesh(exteriorFaces, realBlocks, previewBlocks, buildMode);
    } catch (error) {
      console.error(`[ChunkMesh] Update ${updateId} failed:`, error);
      throw error;
    }
  }

  findExteriorFaces(
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (MeshType | undefined)[][][],
    previewMode: BlockModificationMode,
    dimensions: { xDim: number; yDim: number; zDim: number }
  ): Map<string, VoxelFaces> {
    const exteriorFaces: Map<string, VoxelFaces> = new Map();

    // Use typed arrays for better performance
    const visitedSize =
      (dimensions.xDim + 2) * (dimensions.yDim + 2) * (dimensions.zDim + 2);
    const visited = new Uint8Array(visitedSize);

    // Pre-allocate queue with reasonable capacity
    const queueCapacity = Math.min(visitedSize, 100000);
    const queueX = new Int16Array(queueCapacity);
    const queueY = new Int16Array(queueCapacity);
    const queueZ = new Int16Array(queueCapacity);
    let queueStart = 0;
    let queueEnd = 0;

    const minX = -1;
    const maxX = dimensions.xDim;
    const minY = -1;
    const maxY = dimensions.yDim;
    const minZ = -1;
    const maxZ = dimensions.zDim;

    // Optimize bounds checking with inline functions
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
      return (
        !isInVoxelBounds(x, y, z) ||
        !realBlocks[x]?.[y]?.[z] ||
        (!!previewBlocks?.[x]?.[y]?.[z] &&
          previewMode != BlockModificationMode.Paint)
      );
    };

    const getBlock = (
      x: number,
      y: number,
      z: number
    ): BlockRun | undefined => {
      if (!isInVoxelBounds(x, y, z)) return undefined;
      // TODO: Integrate previewBlocks logic here if needed for face culling
      return realBlocks[x]?.[y]?.[z];
    };

    // 3D coordinate to 1D index mapping for visited array
    const getVisitedIndex = (x: number, y: number, z: number): number => {
      const adjustedX = x + 1; // Shift by 1 since minX = -1
      const adjustedY = y + 1;
      const adjustedZ = z + 1;
      return (
        adjustedX * (dimensions.yDim + 2) * (dimensions.zDim + 2) +
        adjustedY * (dimensions.zDim + 2) +
        adjustedZ
      );
    };

    const isVisited = (x: number, y: number, z: number): boolean => {
      return visited[getVisitedIndex(x, y, z)] === 1;
    };

    const setVisited = (x: number, y: number, z: number): void => {
      visited[getVisitedIndex(x, y, z)] = 1;
    };

    // Queue operations
    const enqueue = (x: number, y: number, z: number): void => {
      if (queueEnd >= queueCapacity) {
        console.warn(
          `[ChunkMesh] Flood fill queue capacity exceeded, skipping (${x}, ${y}, ${z})`
        );
        return;
      }
      queueX[queueEnd] = x;
      queueY[queueEnd] = y;
      queueZ[queueEnd] = z;
      queueEnd++;
    };

    const dequeue = (): { x: number; y: number; z: number } | null => {
      if (queueStart >= queueEnd) return null;
      const result = {
        x: queueX[queueStart],
        y: queueY[queueStart],
        z: queueZ[queueStart],
      };
      queueStart++;
      return result;
    };

    const queueSize = (): number => queueEnd - queueStart;

    // Static direction arrays for better performance
    const directions = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    // Initialize flood fill from multiple border points for faster coverage
    const borderSpacing = 4; // Sample every 4th border point

    // Add points along edges instead of just one corner
    for (let x = minX; x <= maxX; x += borderSpacing) {
      for (let y = minY; y <= maxY; y += borderSpacing) {
        for (let z = minZ; z <= maxZ; z += borderSpacing) {
          // Only add if it's actually on the border
          if (
            x === minX ||
            x === maxX ||
            y === minY ||
            y === maxY ||
            z === minZ ||
            z === maxZ
          ) {
            if (
              isInExplorationBounds(x, y, z) &&
              isAir(x, y, z) &&
              !isVisited(x, y, z)
            ) {
              enqueue(x, y, z);
              setVisited(x, y, z);
            }
          }
        }
      }
    }

    while (queueSize() > 0) {
      const current = dequeue();
      if (!current) break;

      const { x, y, z } = current;

      // Check all 6 directions using static array
      for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
        const dir = directions[dirIndex];
        const nx = x + dir[0];
        const ny = y + dir[1];
        const nz = z + dir[2];

        if (
          isInExplorationBounds(nx, ny, nz) &&
          isAir(nx, ny, nz) &&
          !isVisited(nx, ny, nz)
        ) {
          setVisited(nx, ny, nz);
          enqueue(nx, ny, nz);
        }

        // Check for solid blocks to create exterior faces
        if (!isAir(nx, ny, nz)) {
          const key = `${nx},${ny},${nz}`;
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

  // Fast cached solid block check
  private isSolidCached(
    x: number,
    y: number,
    z: number,
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (MeshType | undefined)[][][],
    previewMode: BlockModificationMode
  ): boolean {
    const key = `${x},${y},${z}`;
    let result = this.solidBlockCache.get(key);

    if (result === undefined) {
      // Check bounds
      if (!realBlocks[x]?.[y]?.[z]) {
        result = false;
      } else {
        // Check if there's a real block
        const hasRealBlock = !!realBlocks[x][y][z];

        // Check preview blocks
        const hasPreviewBlock = !!previewBlocks?.[x]?.[y]?.[z];
        const previewAffectsSolidity =
          hasPreviewBlock && previewMode !== BlockModificationMode.Paint;

        result = hasRealBlock && !previewAffectsSolidity;
      }

      this.solidBlockCache.set(key, result);
    }

    return result;
  }

  // Ultra-fast AO calculation using pre-computed lookup table
  private calculateVertexAOFast(
    blockX: number,
    blockY: number,
    blockZ: number,
    faceIndex: number,
    vertexIndex: number,
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (MeshType | undefined)[][][],
    previewMode: BlockModificationMode
  ): number {
    const checkPositions = AO_LOOKUP[faceIndex][vertexIndex];

    let side1 = false,
      side2 = false,
      corner = false;

    // Check the 3 neighbors: side1, side2, corner
    side1 = this.isSolidCached(
      blockX + checkPositions[0][0],
      blockY + checkPositions[0][1],
      blockZ + checkPositions[0][2],
      realBlocks,
      previewBlocks,
      previewMode
    );

    side2 = this.isSolidCached(
      blockX + checkPositions[1][0],
      blockY + checkPositions[1][1],
      blockZ + checkPositions[1][2],
      realBlocks,
      previewBlocks,
      previewMode
    );

    corner = this.isSolidCached(
      blockX + checkPositions[2][0],
      blockY + checkPositions[2][1],
      blockZ + checkPositions[2][2],
      realBlocks,
      previewBlocks,
      previewMode
    );

    // Standard AO calculation: if both sides are blocked, fully occlude
    // If one side blocked + corner, partial occlusion
    // Otherwise, no occlusion
    if (side1 && side2) {
      return 0.25; // Both sides blocked = maximum occlusion
    }

    const blockedCount = (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
    return 1.0 - blockedCount * 0.2; // Smooth falloff
  }

  private updateMesh(
    exteriorFaces: Map<string, VoxelFaces>,
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (MeshType | undefined)[][][],
    previewMode: BlockModificationMode
  ): void {
    // Pre-calculate total face count
    let totalFaceCount = 0;
    for (const voxelFace of exteriorFaces.values()) {
      totalFaceCount += voxelFace.faceIndexes.length;
    }

    // Pre-allocate arrays with exact sizes for better performance
    const totalVertices = totalFaceCount * 4;
    const totalIndices = totalFaceCount * 6;

    const vertices = new Float32Array(totalVertices * 3);
    const indices = new Uint32Array(totalIndices);
    const normals = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);

    let vertexOffset = 0;
    let indexOffset = 0;
    let vertexIndex = 0;

    // Cache for color objects to avoid repeated parsing
    const colorCache = new Map<string, { r: number; g: number; b: number }>();

    for (const voxelFace of exteriorFaces.values()) {
      const { color, gridPos, faceIndexes } = voxelFace;

      // Get cached color or create new one
      let colorRGB = colorCache.get(color);
      if (!colorRGB) {
        const colorObj = new THREE.Color(color);
        colorRGB = { r: colorObj.r, g: colorObj.g, b: colorObj.b };
        colorCache.set(color, colorRGB);
      }

      const { r, g, b } = colorRGB;
      const posX = gridPos.x + 0.5;
      const posY = gridPos.y + 0.5;
      const posZ = gridPos.z + 0.5;
      const blockX = gridPos.x;
      const blockY = gridPos.y;
      const blockZ = gridPos.z;

      // Process each face of this voxel
      for (let i = 0; i < faceIndexes.length; i++) {
        const faceIndex = faceIndexes[i];
        const face = faces[faceIndex];
        const faceVertices = face.vertices;
        const faceNormal = face.normal;
        const normalX = faceNormal[0];
        const normalY = faceNormal[1];
        const normalZ = faceNormal[2];

        const startVertexIndex = vertexIndex;

        // Add 4 vertices for this quad face
        for (let j = 0; j < 4; j++) {
          const vertex = faceVertices[j];

          // Calculate ambient occlusion for this vertex using lookup table
          const aoFactor = this.calculateVertexAOFast(
            blockX,
            blockY,
            blockZ,
            faceIndex,
            j,
            realBlocks,
            previewBlocks,
            previewMode
          );

          // Position
          vertices[vertexOffset] = vertex[0] + posX;
          vertices[vertexOffset + 1] = vertex[1] + posY;
          vertices[vertexOffset + 2] = vertex[2] + posZ;

          // Normal
          normals[vertexOffset] = normalX;
          normals[vertexOffset + 1] = normalY;
          normals[vertexOffset + 2] = normalZ;

          // Color with ambient occlusion applied
          colors[vertexOffset] = r * aoFactor;
          colors[vertexOffset + 1] = g * aoFactor;
          colors[vertexOffset + 2] = b * aoFactor;

          vertexOffset += 3;
          vertexIndex++;
        }

        // Create two triangles from the quad
        indices[indexOffset] = startVertexIndex;
        indices[indexOffset + 1] = startVertexIndex + 1;
        indices[indexOffset + 2] = startVertexIndex + 2;

        indices[indexOffset + 3] = startVertexIndex;
        indices[indexOffset + 4] = startVertexIndex + 2;
        indices[indexOffset + 5] = startVertexIndex + 3;

        indexOffset += 6;
      }
    }

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

    // Set attributes using pre-allocated typed arrays
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );
    this.geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    if (this.geometry.index) {
      this.geometry.index.needsUpdate = true;
    }

    this.geometry.computeBoundingSphere();
  }

  dispose() {
    this.currentUpdateId++;

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

    // Clear caches
    this.solidBlockCache.clear();
  }
}
