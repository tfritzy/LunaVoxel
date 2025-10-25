import * as THREE from "three";
import { Chunk } from "../lib/chunk";
import { CHUNK_SIZE } from "../lib/chunk-mesh";

export interface ConsolidatedMesh {
  vertices: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export class MeshConsolidator {
  private chunkManager: Chunk;
  private worldDimensions: { x: number; y: number; z: number };

  constructor(
    chunkManager: Chunk,
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
    const chunkDimensions = this.chunkManager.getChunkDimensions();

    const centerOffset = {
      x: this.worldDimensions.x / 2,
      y: 0,
      z: this.worldDimensions.z / 2,
    };

    for (let chunkX = 0; chunkX < chunkDimensions.x; chunkX++) {
      for (let chunkY = 0; chunkY < chunkDimensions.y; chunkY++) {
        for (let chunkZ = 0; chunkZ < chunkDimensions.z; chunkZ++) {
          const chunk = this.chunkManager.getChunk(chunkX, chunkY, chunkZ);

          if (!chunk) continue;

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

          const chunkWorldOffset = {
            x: chunkX * CHUNK_SIZE,
            y: chunkY * CHUNK_SIZE,
            z: chunkZ * CHUNK_SIZE,
          };

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
      }
    }

    return {
      vertices,
      normals,
      uvs,
      indices,
    };
  }
}
