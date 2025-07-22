import * as THREE from "three";
import {
  Atlas,
  BlockModificationMode,
  Layer,
  ProjectBlocks,
} from "@/module_bindings";
import { findExteriorFaces } from "./find-exterior-faces";
import { layers } from "./layers";
import { Block } from "./blocks";
import { createVoxelMaterial } from "./shader";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { calculateVertexAO } from "./ambient-occlusion";

export type VoxelFaces = {
  textureIndex: number;
  gridPos: THREE.Vector3;
  faceIndexes: number[];
};

export const LayerMesh = class {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private textureAtlas: THREE.Texture | null = null;
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

  setTextureAtlas = (textureAtlas: THREE.Texture) => {
    this.textureAtlas = textureAtlas;
    if (this.material) {
      this.material.uniforms.map.value = textureAtlas;
      this.material.needsUpdate = true;
    }
    if (this.previewMesh?.material) {
      (this.previewMesh.material as THREE.ShaderMaterial).uniforms.map.value =
        textureAtlas;
      (this.previewMesh.material as THREE.ShaderMaterial).needsUpdate = true;
    }
  };

  decompressBlocks(
    rleBytes: Uint8Array,
    xDim: number,
    yDim: number,
    zDim: number
  ): (Block | undefined)[][][] {
    const decompressed: (Block | undefined)[][][] = Array(xDim)
      .fill(null)
      .map(() =>
        Array(yDim)
          .fill(null)
          .map(() => Array(zDim).fill(undefined))
      );

    let byteIndex = 0;
    let blockIndex = 0;

    while (byteIndex < rleBytes.length) {
      const runLength = (rleBytes[byteIndex + 1] << 8) | rleBytes[byteIndex];
      const blockBytes = rleBytes.slice(byteIndex + 2, byteIndex + 4);

      const block = this.blockFromBytes(blockBytes);

      for (let i = 0; i < runLength; i++) {
        const x = Math.floor(blockIndex / (yDim * zDim));
        const y = Math.floor((blockIndex % (yDim * zDim)) / zDim);
        const z = blockIndex % zDim;

        if (x < xDim && y < yDim && z < zDim) {
          decompressed[x][y][z] = block.type === 0 ? undefined : block;
        }

        blockIndex++;
      }

      byteIndex += 4;
    }

    return decompressed;
  }

  private addLayerToBlocks(
    blocks: (Block | undefined)[][][],
    layer: Layer,
    xDim: number,
    yDim: number,
    zDim: number
  ): void {
    if (layer.xDim !== xDim || layer.yDim !== yDim || layer.zDim !== zDim) {
      return;
    }

    let byteIndex = 0;
    let blockIndex = 0;

    while (byteIndex < layer.voxels.length) {
      const runLength =
        (layer.voxels[byteIndex + 1] << 8) | layer.voxels[byteIndex];
      const blockBytes = layer.voxels.slice(byteIndex + 2, byteIndex + 4);
      const block = this.blockFromBytes(blockBytes);

      if (block.type !== 0) {
        for (let i = 0; i < runLength; i++) {
          const x = Math.floor(blockIndex / (yDim * zDim));
          const y = Math.floor((blockIndex % (yDim * zDim)) / zDim);
          const z = blockIndex % zDim;

          if (x < xDim && y < yDim && z < zDim && !blocks[x][y][z]) {
            blocks[x][y][z] = block;
          }

          blockIndex++;
        }
      } else {
        blockIndex += runLength;
      }

      byteIndex += 4;
    }
  }

  private blockFromBytes(bytes: Uint8Array): Block {
    const combined = (bytes[0] << 8) | bytes[1];
    const type = combined >> 6;
    const rotation = combined & 0x07;

    return { type, rotation };
  }

  update = (
    layerList: Layer[],
    previewBlocks: (Block | undefined)[][][],
    buildMode: BlockModificationMode,
    atlas: Atlas,
    blocks: ProjectBlocks
  ) => {
    const updateId = ++this.currentUpdateId;

    try {
      const visibleLayers = layerList.filter((layer) => layer.visible);

      let realBlocks: (Block | undefined)[][][];
      let dimensions: { xDim: number; yDim: number; zDim: number };

      if (visibleLayers.length === 0) {
        dimensions =
          layerList.length > 0
            ? {
                xDim: layerList[0].xDim,
                yDim: layerList[0].yDim,
                zDim: layerList[0].zDim,
              }
            : { xDim: 0, yDim: 0, zDim: 0 };

        realBlocks = Array(dimensions.xDim)
          .fill(null)
          .map(() =>
            Array(dimensions.yDim)
              .fill(null)
              .map(() => Array(dimensions.zDim).fill(undefined))
          );
      } else {
        const firstLayer = visibleLayers[0];
        dimensions = {
          xDim: firstLayer.xDim,
          yDim: firstLayer.yDim,
          zDim: firstLayer.zDim,
        };

        realBlocks = this.decompressBlocks(
          firstLayer.voxels,
          firstLayer.xDim,
          firstLayer.yDim,
          firstLayer.zDim
        );

        if (updateId !== this.currentUpdateId) {
          return;
        }

        for (let i = 1; i < visibleLayers.length; i++) {
          this.addLayerToBlocks(
            realBlocks,
            visibleLayers[i],
            dimensions.xDim,
            dimensions.yDim,
            dimensions.zDim
          );

          if (updateId !== this.currentUpdateId) {
            return;
          }
        }
      }

      this.cacheVersion++;

      const { meshFaces, previewFaces } = findExteriorFaces(
        realBlocks,
        previewBlocks,
        buildMode,
        atlas,
        blocks,
        dimensions
      );

      if (updateId !== this.currentUpdateId) {
        return;
      }

      this.updateMesh(meshFaces, realBlocks, previewBlocks, buildMode, atlas);
      this.updatePreviewMesh(previewFaces, buildMode, atlas);
    } catch (error) {
      console.error(`[LayerMesh] Update ${updateId} failed:`, error);
      throw error;
    }
  };

  private updateMesh(
    exteriorFaces: Map<string, VoxelFaces>,
    realBlocks: (Block | undefined)[][][],
    previewBlocks: (Block | undefined)[][][],
    previewMode: BlockModificationMode,
    atlas: Atlas
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
    const uvs = new Float32Array(totalVertices * 2);
    const ao = new Float32Array(totalVertices);
    let vertexOffset = 0;
    let indexOffset = 0;
    let vertexIndex = 0;
    let uvOffset = 0;
    let aoOffset = 0;

    for (const voxelFace of exteriorFaces.values()) {
      const { textureIndex, gridPos, faceIndexes } = voxelFace;
      const posX = gridPos.x + 0.5;
      const posY = gridPos.y + 0.5;
      const posZ = gridPos.z + 0.5;

      const textureCoords = getTextureCoordinates(
        textureIndex,
        atlas.gridSize,
        atlas.cellPixelWidth
      );

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
            gridPos.x,
            gridPos.y,
            gridPos.z,
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

          uvs[uvOffset] = textureCoords[j * 2];
          uvs[uvOffset + 1] = textureCoords[j * 2 + 1];

          ao[aoOffset] = aoFactor;

          vertexOffset += 3;
          uvOffset += 2;
          aoOffset += 1;
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
      this.material = createVoxelMaterial(this.textureAtlas!);
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
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    this.geometry.setAttribute("aochannel", new THREE.BufferAttribute(ao, 1));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.aochannel.needsUpdate = true;
    if (this.geometry.index) {
      this.geometry.index.needsUpdate = true;
    }
    this.geometry.computeBoundingSphere();
  }

  private updatePreviewMesh(
    previewFaces: Map<string, VoxelFaces>,
    buildMode: BlockModificationMode,
    atlas: Atlas
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
    const uvs = new Float32Array(totalVertices * 2);
    const ao = new Float32Array(totalVertices);

    let vertexOffset = 0;
    let indexOffset = 0;
    let vertexIndex = 0;
    let uvOffset = 0;
    let aoOffset = 0;

    for (const voxelFace of previewFaces.values()) {
      const { textureIndex, gridPos, faceIndexes } = voxelFace;

      const posX = gridPos.x + 0.5;
      const posY = gridPos.y + 0.5;
      const posZ = gridPos.z + 0.5;

      const textureCoords = getTextureCoordinates(
        textureIndex,
        atlas.gridSize,
        atlas.cellPixelWidth
      );

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

          uvs[uvOffset] = textureCoords[j * 2];
          uvs[uvOffset + 1] = textureCoords[j * 2 + 1];

          ao[aoOffset] = 1.0;

          vertexOffset += 3;
          uvOffset += 2;
          aoOffset += 1;
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
      const material = createVoxelMaterial(this.textureAtlas!, 0.5);
      material.transparent = true;
      material.opacity = 0.3;
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
    this.previewMesh?.geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(uvs, 2)
    );
    this.previewMesh?.geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(ao, 1)
    );
    this.previewMesh?.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.previewMesh!.visible =
      buildMode.tag === BlockModificationMode.Build.tag;
    this.previewMesh!.layers.set(
      buildMode.tag === BlockModificationMode.Erase.tag
        ? layers.raycast
        : layers.ghost
    );
    this.previewMesh!.geometry.attributes.position.needsUpdate = true;
    this.previewMesh!.geometry.attributes.normal.needsUpdate = true;
    this.previewMesh!.geometry.attributes.uv.needsUpdate = true;
    this.previewMesh!.geometry.attributes.aochannel.needsUpdate = true;
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
};
