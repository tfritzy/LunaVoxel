import { OctreeManager } from "../lib/octree-manager";

export interface ConsolidatedMesh {
  vertices: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export class MeshConsolidator {
  private octreeManager: OctreeManager;
  private worldDimensions: { x: number; y: number; z: number };

  constructor(
    octreeManager: OctreeManager,
    worldDimensions: { x: number; y: number; z: number }
  ) {
    this.octreeManager = octreeManager;
    this.worldDimensions = worldDimensions;
  }

  public consolidateOctreeMesh(): ConsolidatedMesh {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const centerOffset = {
      x: this.worldDimensions.x / 2,
      y: 0,
      z: this.worldDimensions.z / 2,
    };

    const mesh = this.octreeManager.getMesh();
    if (!mesh || !mesh.geometry) {
      return { vertices, normals, uvs, indices };
    }

    const geometry = mesh.geometry;

    const positionAttribute = geometry.getAttribute("position");
    const normalAttribute = geometry.getAttribute("normal");
    const uvAttribute = geometry.getAttribute("uv");
    const indexAttribute = geometry.getIndex();

    if (!positionAttribute || !normalAttribute || !uvAttribute || !indexAttribute) {
      return { vertices, normals, uvs, indices };
    }

    const positionArray = positionAttribute.array as Float32Array;
    const normalArray = normalAttribute.array as Float32Array;
    const uvArray = uvAttribute.array as Float32Array;
    const indexArray = indexAttribute.array;

    for (let i = 0; i < positionArray.length; i += 3) {
      vertices.push(
        positionArray[i] - centerOffset.x,
        positionArray[i + 1] - centerOffset.y,
        positionArray[i + 2] - centerOffset.z
      );
    }

    for (let i = 0; i < normalArray.length; i++) {
      normals.push(normalArray[i]);
    }

    for (let i = 0; i < uvArray.length; i++) {
      uvs.push(uvArray[i]);
    }

    for (let i = 0; i < indexArray.length; i++) {
      indices.push(indexArray[i]);
    }

    return {
      vertices,
      normals,
      uvs,
      indices,
    };
  }
}
