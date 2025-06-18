import * as THREE from "three";
import {
  BlockModificationMode,
  BlockRun,
  Chunk,
  MeshType,
} from "@/module_bindings";
import { calculateVertexAOFast as calculateVertexAO } from "./ambient-occlusion";
import { findExteriorFaces } from "./find-exterior-faces";
import { layers } from "./layers";

export type VoxelFaces = {
  color: number;
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

export class ChunkMesh {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.MeshLambertMaterial | null = null;

  // Preview mesh properties
  private previewMesh: THREE.Mesh | null = null;

  private currentUpdateId: number = 0;
  private cacheVersion: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.previewMesh = null;
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
      const realBlocks = this.decompressBlocks(newChunk.blocks);

      if (updateId !== this.currentUpdateId) {
        return;
      }

      this.cacheVersion++;

      const { meshFaces, previewFaces } = findExteriorFaces(
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

      // Update both main mesh and preview mesh
      this.updateMesh(meshFaces, realBlocks, previewBlocks, buildMode);
      this.updatePreviewMesh(previewFaces, buildMode);
    } catch (error) {
      console.error(`[ChunkMesh] Update ${updateId} failed:`, error);
      throw error;
    }
  }

  private updateMesh(
    exteriorFaces: Map<string, VoxelFaces>,
    realBlocks: (BlockRun | undefined)[][][],
    previewBlocks: (MeshType | undefined)[][][],
    previewMode: BlockModificationMode
  ): void {
    let totalFaceCount = 0;
    for (const voxelFace of exteriorFaces.values()) {
      totalFaceCount += voxelFace.faceIndexes.length;
    }

    const totalVertices = totalFaceCount * 4;
    const totalIndices = totalFaceCount * 6;

    const vertices = new Float32Array(totalVertices * 3);
    const indices = new Uint32Array(totalIndices);
    const normals = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);

    let vertexOffset = 0;
    let indexOffset = 0;
    let vertexIndex = 0;

    const colorCache = new Map<number, THREE.Color>();

    for (const voxelFace of exteriorFaces.values()) {
      const { color, gridPos, faceIndexes } = voxelFace;

      let colorObj = colorCache.get(color);
      if (!colorObj) {
        colorObj = new THREE.Color(color);
        colorCache.set(color, colorObj);
      }

      const posX = gridPos.x + 0.5;
      const posY = gridPos.y + 0.5;
      const posZ = gridPos.z + 0.5;
      const blockX = gridPos.x;
      const blockY = gridPos.y;
      const blockZ = gridPos.z;

      for (let i = 0; i < faceIndexes.length; i++) {
        const faceIndex = faceIndexes[i];
        const face = faces[faceIndex];
        const faceVertices = face.vertices;
        const faceNormal = face.normal;
        const normalX = faceNormal[0];
        const normalY = faceNormal[1];
        const normalZ = faceNormal[2];

        const startVertexIndex = vertexIndex;

        for (let j = 0; j < 4; j++) {
          const vertex = faceVertices[j];

          const aoFactor = calculateVertexAO(
            blockX,
            blockY,
            blockZ,
            faceIndex,
            j,
            realBlocks,
            previewBlocks,
            previewMode
          );

          vertices[vertexOffset] = vertex[0] + posX;
          vertices[vertexOffset + 1] = vertex[1] + posY;
          vertices[vertexOffset + 2] = vertex[2] + posZ;

          normals[vertexOffset] = normalX;
          normals[vertexOffset + 1] = normalY;
          normals[vertexOffset + 2] = normalZ;

          colors[vertexOffset] = colorObj!.r * aoFactor;
          colors[vertexOffset + 1] = colorObj!.g * aoFactor;
          colors[vertexOffset + 2] = colorObj!.b * aoFactor;

          vertexOffset += 3;
          vertexIndex++;
        }

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

  private updatePreviewMesh(
    previewFaces: Map<string, VoxelFaces>,
    buildMode: BlockModificationMode
  ): void {
    let totalFaceCount = 0;
    for (const voxelFace of previewFaces.values()) {
      totalFaceCount += voxelFace.faceIndexes.length;
    }

    const totalVertices = totalFaceCount * 4;
    const totalIndices = totalFaceCount * 6;

    const vertices = new Float32Array(totalVertices * 3);
    const indices = new Uint32Array(totalIndices);
    const normals = new Float32Array(totalVertices * 3);

    let vertexOffset = 0;
    let indexOffset = 0;
    let vertexIndex = 0;

    for (const voxelFace of previewFaces.values()) {
      const { gridPos, faceIndexes } = voxelFace;

      const posX = gridPos.x + 0.5;
      const posY = gridPos.y + 0.5;
      const posZ = gridPos.z + 0.5;

      for (let i = 0; i < faceIndexes.length; i++) {
        const faceIndex = faceIndexes[i];
        const face = faces[faceIndex];
        const faceVertices = face.vertices;
        const faceNormal = face.normal;
        const normalX = faceNormal[0];
        const normalY = faceNormal[1];
        const normalZ = faceNormal[2];

        const startVertexIndex = vertexIndex;

        for (let j = 0; j < 4; j++) {
          const vertex = faceVertices[j];

          vertices[vertexOffset] = vertex[0] + posX;
          vertices[vertexOffset + 1] = vertex[1] + posY;
          vertices[vertexOffset + 2] = vertex[2] + posZ;

          normals[vertexOffset] = normalX;
          normals[vertexOffset + 1] = normalY;
          normals[vertexOffset + 2] = normalZ;

          vertexOffset += 3;
          vertexIndex++;
        }

        indices[indexOffset] = startVertexIndex;
        indices[indexOffset + 1] = startVertexIndex + 1;
        indices[indexOffset + 2] = startVertexIndex + 2;

        indices[indexOffset + 3] = startVertexIndex;
        indices[indexOffset + 4] = startVertexIndex + 2;
        indices[indexOffset + 5] = startVertexIndex + 3;

        indexOffset += 6;
      }
    }

    if (!this.previewMesh) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshLambertMaterial({
        side: THREE.FrontSide,
        opacity: 0.3,
        transparent: true,
      });
      this.previewMesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.previewMesh);
    }

    this.previewMesh?.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );
    this.previewMesh?.geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(normals, 3)
    );
    this.previewMesh?.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.previewMesh!.visible =
      buildMode.tag === BlockModificationMode.Build.tag;
    (this.previewMesh.material as THREE.MeshLambertMaterial).color.set(
      0x5577ff
    );
    this.previewMesh!.layers.set(
      buildMode.tag === BlockModificationMode.Erase.tag
        ? layers.raycast
        : layers.ghost
    );
    this.previewMesh!.geometry.attributes.position.needsUpdate = true;
    this.previewMesh!.geometry.attributes.normal.needsUpdate = true;
    if (this.previewMesh!.geometry.index) {
      this.previewMesh!.geometry.index.needsUpdate = true;
    }

    this.previewMesh?.geometry.computeBoundingSphere();
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

    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
    }
  }
}
