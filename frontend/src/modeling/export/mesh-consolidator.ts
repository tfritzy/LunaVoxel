import { ChunkManager } from "../lib/chunk-manager";

export interface ConsolidatedMesh {
  vertices: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export class MeshConsolidator {
  private chunkManager: ChunkManager;
  private worldDimensions: { x: number; y: number; z: number };

  constructor(
    chunkManager: ChunkManager,
    worldDimensions: { x: number; y: number; z: number }
  ) {
    this.chunkManager = chunkManager;
    this.worldDimensions = worldDimensions;
  }

  public consolidateAllChunks(): ConsolidatedMesh {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertexOffset = 0;

    const centerOffset = {
      x: this.worldDimensions.x / 2,
      y: 0,
      z: this.worldDimensions.z / 2,
    };

    for (const chunk of this.chunkManager.getChunks()) {
      const chunkMesh = chunk.getMesh();
      if (!chunkMesh || !chunkMesh.geometry) continue;

      const geometry = chunkMesh.geometry;

      const positionAttribute = geometry.getAttribute("position");
      const normalAttribute = geometry.getAttribute("normal");
      const uvAttribute = geometry.getAttribute("uv");
      const indexAttribute = geometry.getIndex();

      if (
        !positionAttribute ||
        !normalAttribute ||
        !uvAttribute ||
        !indexAttribute
      ) {
        continue;
      }

      const chunkWorldOffset = chunk.minPos;

      const positionArray = positionAttribute.array as Float32Array;
      const normalArray = normalAttribute.array as Float32Array;
      const uvArray = uvAttribute.array as Float32Array;
      const indexArray = indexAttribute.array;

      for (let i = 0; i < positionArray.length; i += 3) {
        vertices.push(
          positionArray[i] + chunkWorldOffset.x - centerOffset.x,
          positionArray[i + 1] + chunkWorldOffset.y - centerOffset.y,
          positionArray[i + 2] + chunkWorldOffset.z - centerOffset.z
        );
      }

      for (let i = 0; i < normalArray.length; i++) {
        normals.push(normalArray[i]);
      }

      for (let i = 0; i < uvArray.length; i++) {
        uvs.push(uvArray[i]);
      }

      for (let i = 0; i < indexArray.length; i++) {
        indices.push(indexArray[i] + vertexOffset);
      }

      vertexOffset += positionArray.length / 3;
    }

    return {
      vertices,
      normals,
      uvs,
      indices,
    };
  }
}
