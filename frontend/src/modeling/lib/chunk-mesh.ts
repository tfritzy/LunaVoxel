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
  private currentUpdateId: number = 0;

  constructor(scene: THREE.Scene) {
    console.log("[ChunkMesh] Constructor called");
    this.scene = scene;
    this.mesh = null;
    this.geometry = null;
    this.material = null;
  }

  decompressBlocks(blocks: BlockRun[]): (BlockRun | undefined)[][][] {
    const startTime = performance.now();
    console.log(
      `[ChunkMesh] Starting block decompression with ${blocks.length} block runs`
    );

    const decompressed: (BlockRun | undefined)[][][] = [];
    let totalVoxels = 0;

    for (const blockRun of blocks) {
      const { topLeft, bottomRight } = blockRun;
      const runSize =
        (bottomRight.x - topLeft.x + 1) *
        (bottomRight.y - topLeft.y + 1) *
        (bottomRight.z - topLeft.z + 1);
      totalVoxels += runSize;

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

    const endTime = performance.now();
    console.log(
      `[ChunkMesh] Block decompression completed in ${(
        endTime - startTime
      ).toFixed(2)}ms`
    );
    console.log(`[ChunkMesh] Total voxels processed: ${totalVoxels}`);

    return decompressed;
  }

  async update(
    newChunk: Chunk,
    previewVoxels?: PreviewVoxels | null,
    signal?: AbortSignal
  ): Promise<void> {
    const updateStartTime = performance.now();
    const updateId = ++this.currentUpdateId;

    console.log(`[ChunkMesh] Starting update ${updateId}`);
    console.log(
      `[ChunkMesh] Chunk dimensions: ${newChunk.xDim}x${newChunk.yDim}x${newChunk.zDim}`
    );
    console.log(
      `[ChunkMesh] Preview voxels: ${previewVoxels ? "present" : "none"}`
    );

    if (signal?.aborted) {
      console.log(`[ChunkMesh] Update ${updateId} aborted before starting`);
      return;
    }

    try {
      // Decompress real blocks
      const realBlocksStart = performance.now();
      const realBlocks = this.decompressBlocks(newChunk.blocks);
      const realBlocksEnd = performance.now();
      console.log(
        `[ChunkMesh] Real blocks decompression: ${(
          realBlocksEnd - realBlocksStart
        ).toFixed(2)}ms`
      );

      if (signal?.aborted || updateId !== this.currentUpdateId) {
        console.log(
          `[ChunkMesh] Update ${updateId} aborted after real blocks decompression`
        );
        return;
      }

      // Decompress preview blocks
      let previewBlocks = null;
      if (previewVoxels) {
        const previewBlocksStart = performance.now();
        previewBlocks = this.decompressBlocks(previewVoxels.previewPositions);
        const previewBlocksEnd = performance.now();
        console.log(
          `[ChunkMesh] Preview blocks decompression: ${(
            previewBlocksEnd - previewBlocksStart
          ).toFixed(2)}ms`
        );
      }

      if (signal?.aborted || updateId !== this.currentUpdateId) {
        console.log(
          `[ChunkMesh] Update ${updateId} aborted after preview blocks decompression`
        );
        return;
      }

      // Find exterior faces
      const exteriorFacesStart = performance.now();
      const exteriorFaces = await this.findExteriorFaces(
        realBlocks,
        previewBlocks,
        {
          xDim: newChunk.xDim,
          yDim: newChunk.yDim,
          zDim: newChunk.zDim,
        },
        signal
      );
      const exteriorFacesEnd = performance.now();
      console.log(
        `[ChunkMesh] Exterior faces calculation: ${(
          exteriorFacesEnd - exteriorFacesStart
        ).toFixed(2)}ms`
      );

      if (signal?.aborted || updateId !== this.currentUpdateId) {
        console.log(
          `[ChunkMesh] Update ${updateId} aborted after exterior faces calculation`
        );
        return;
      }

      // Update mesh
      const meshUpdateStart = performance.now();
      await this.updateMesh(exteriorFaces, signal);
      const meshUpdateEnd = performance.now();
      console.log(
        `[ChunkMesh] Mesh update: ${(meshUpdateEnd - meshUpdateStart).toFixed(
          2
        )}ms`
      );

      const updateEndTime = performance.now();
      console.log(
        `[ChunkMesh] Update ${updateId} completed in ${(
          updateEndTime - updateStartTime
        ).toFixed(2)}ms`
      );
    } catch (error) {
      if (error.name === "AbortError") {
        console.log(`[ChunkMesh] Update ${updateId} aborted via signal`);
        return;
      }
      console.error(`[ChunkMesh] Update ${updateId} failed:`, error);
      throw error;
    }
  }

  async findExteriorFaces(
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (BlockRun | undefined)[][][] | null,
    dimensions: { xDim: number; yDim: number; zDim: number },
    signal?: AbortSignal
  ): Promise<Map<string, VoxelFaces>> {
    const startTime = performance.now();
    console.log(
      `[ChunkMesh] Starting optimized exterior face detection for ${dimensions.xDim}x${dimensions.yDim}x${dimensions.zDim} chunk`
    );

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
          `[ChunkMesh] Queue capacity exceeded, skipping (${x}, ${y}, ${z})`
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
    const initializationStart = performance.now();

    // Add border points more efficiently
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

    const initializationTime = performance.now() - initializationStart;
    console.log(
      `[ChunkMesh] Initialization: ${initializationTime.toFixed(
        2
      )}ms, initial queue size: ${queueSize()}`
    );

    let processedNodes = 0;
    let lastLogTime = performance.now();
    const checkInterval = 5000; // Less frequent checks
    const logInterval = 5000;

    console.log(`[ChunkMesh] Starting optimized flood fill`);

    const mainLoopStart = performance.now();

    while (queueSize() > 0) {
      if (signal?.aborted) {
        console.log(
          `[ChunkMesh] Flood fill aborted after processing ${processedNodes} nodes`
        );
        throw new DOMException("Operation aborted", "AbortError");
      }

      // Process in batches for better performance
      const batchSize = Math.min(1000, queueSize());

      for (let batch = 0; batch < batchSize; batch++) {
        const current = dequeue();
        if (!current) break;

        const { x, y, z } = current;
        processedNodes++;

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

      // Periodic logging and yielding
      if (processedNodes % checkInterval === 0) {
        const currentTime = performance.now();
        if (currentTime - lastLogTime > logInterval) {
          console.log(
            `[ChunkMesh] Flood fill progress: ${processedNodes} nodes processed, ${queueSize()} in queue, ${
              exteriorFaces.size
            } exterior faces found`
          );
          lastLogTime = currentTime;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const mainLoopTime = performance.now() - mainLoopStart;
    const endTime = performance.now();

    console.log(`[ChunkMesh] Main loop: ${mainLoopTime.toFixed(2)}ms`);
    console.log(
      `[ChunkMesh] Optimized flood fill completed in ${(
        endTime - startTime
      ).toFixed(2)}ms`
    );
    console.log(
      `[ChunkMesh] Final stats: ${processedNodes} nodes processed, ${exteriorFaces.size} exterior faces found`
    );
    console.log(
      `[ChunkMesh] Performance: ${(
        (processedNodes / (endTime - startTime)) *
        1000
      ).toFixed(0)} nodes/second`
    );

    return exteriorFaces;
  }

  private async updateMesh(
    exteriorFaces: Map<string, VoxelFaces>,
    signal?: AbortSignal
  ): Promise<void> {
    const startTime = performance.now();
    console.log(
      `[ChunkMesh] Starting mesh update with ${exteriorFaces.size} exterior faces`
    );

    if (signal?.aborted) {
      console.log(`[ChunkMesh] Mesh update aborted before starting`);
      throw new DOMException("Operation aborted", "AbortError");
    }

    // Pre-calculate total face count
    let totalFaceCount = 0;
    for (const voxelFace of exteriorFaces.values()) {
      totalFaceCount += voxelFace.faceIndexes.length;
    }
    console.log(
      `[ChunkMesh] Total individual faces to process: ${totalFaceCount}`
    );

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
    let processedFaces = 0;
    let lastLogTime = startTime;
    const checkInterval = 1000;
    const logInterval = 2000; // Log progress every 2 seconds

    // Cache for color objects to avoid repeated parsing
    const colorCache = new Map<string, { r: number; g: number; b: number }>();

    const processingStartTime = performance.now();

    for (const voxelFace of exteriorFaces.values()) {
      if (signal?.aborted) {
        console.log(
          `[ChunkMesh] Mesh update aborted after processing ${processedFaces} voxel faces`
        );
        throw new DOMException("Operation aborted", "AbortError");
      }

      if (++processedFaces % checkInterval === 0) {
        const currentTime = performance.now();
        if (currentTime - lastLogTime > logInterval) {
          const progress = (
            (processedFaces / exteriorFaces.size) *
            100
          ).toFixed(1);
          console.log(
            `[ChunkMesh] Progress: ${processedFaces}/${exteriorFaces.size} voxel faces (${progress}%)`
          );
          lastLogTime = currentTime;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

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

          // Position
          vertices[vertexOffset] = vertex[0] + posX;
          vertices[vertexOffset + 1] = vertex[1] + posY;
          vertices[vertexOffset + 2] = vertex[2] + posZ;

          // Normal
          normals[vertexOffset] = normalX;
          normals[vertexOffset + 1] = normalY;
          normals[vertexOffset + 2] = normalZ;

          // Color
          colors[vertexOffset] = r;
          colors[vertexOffset + 1] = g;
          colors[vertexOffset + 2] = b;

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

    const processingEndTime = performance.now();
    console.log(
      `[ChunkMesh] Face processing completed in ${(
        processingEndTime - processingStartTime
      ).toFixed(2)}ms`
    );
    console.log(
      `[ChunkMesh] Color cache size: ${colorCache.size} unique colors`
    );

    console.log(
      `[ChunkMesh] Creating geometry with ${totalVertices} vertices, ${
        totalIndices / 3
      } triangles`
    );

    if (signal?.aborted) {
      console.log(`[ChunkMesh] Mesh update aborted before geometry creation`);
      throw new DOMException("Operation aborted", "AbortError");
    }

    const geometryStartTime = performance.now();

    if (!this.geometry) {
      console.log(`[ChunkMesh] Creating new geometry and mesh`);
      this.geometry = new THREE.BufferGeometry();
      this.material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.FrontSide,
      });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
    } else {
      console.log(`[ChunkMesh] Updating existing geometry`);
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

    const geometryEndTime = performance.now();

    const endTime = performance.now();
    console.log(
      `[ChunkMesh] Geometry operations: ${(
        geometryEndTime - geometryStartTime
      ).toFixed(2)}ms`
    );
    console.log(
      `[ChunkMesh] Total mesh update completed in ${(
        endTime - startTime
      ).toFixed(2)}ms`
    );
    console.log(
      `[ChunkMesh] Final mesh stats: ${totalVertices} vertices, ${
        totalIndices / 3
      } triangles`
    );
  }

  dispose() {
    console.log(
      `[ChunkMesh] Disposing mesh, cancelling update ${this.currentUpdateId}`
    );
    this.currentUpdateId++;

    if (this.mesh) {
      console.log(
        `[ChunkMesh] Removing mesh from scene and disposing resources`
      );
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
      console.log(`[ChunkMesh] Disposal complete`);
    } else {
      console.log(`[ChunkMesh] No mesh to dispose`);
    }
  }
}
