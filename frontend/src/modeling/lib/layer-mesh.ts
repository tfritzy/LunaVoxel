import * as THREE from "three";
import {
  Atlas,
  BlockModificationMode,
  Layer,
  ProjectBlocks,
  Vector3,
} from "@/module_bindings";
import { findExteriorFaces } from "./find-exterior-faces";
import { layers } from "./layers";
import { Block } from "./blocks";
import { createVoxelMaterial } from "./shader";
import { faces } from "./voxel-constants";
import { getTextureCoordinates } from "./texture-coords";
import { calculateVertexAO } from "./ambient-occlusion";
import { MeshArrays } from "./mesh-arrays";

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
  private meshArrays: MeshArrays;
  private previewMeshArrays: MeshArrays;
  private realBlocks: (Block | undefined)[][][];
  private previewBlocks: (Block | undefined)[][][];
  private dimensions: Vector3;

  constructor(scene: THREE.Scene, dimensions: Vector3) {
    this.scene = scene;
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.previewMesh = null;
    this.dimensions = dimensions;

    const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;

    this.meshArrays = new MeshArrays(maxVertices, maxIndices);
    this.previewMeshArrays = new MeshArrays(maxVertices, maxIndices);

    this.realBlocks = Array(dimensions.x)
      .fill(null)
      .map(() =>
        Array(dimensions.y)
          .fill(null)
          .map(() => Array(dimensions.z).fill(undefined))
      );

    this.previewBlocks = Array(dimensions.x)
      .fill(null)
      .map(() =>
        Array(dimensions.y)
          .fill(null)
          .map(() => Array(dimensions.z).fill(undefined))
      );
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

  private clearBlocks(blocks: (Block | undefined)[][][]): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;
    for (let x = 0; x < xDim; x++) {
      for (let y = 0; y < yDim; y++) {
        for (let z = 0; z < zDim; z++) {
          blocks[x][y][z] = undefined;
        }
      }
    }
  }

  private decompressBlocksInto(
    rleBytes: Uint8Array,
    blocks: (Block | undefined)[][][]
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;
    const yzDim = yDim * zDim;

    this.clearBlocks(blocks);

    let byteIndex = 0;
    let blockIndex = 0;

    while (byteIndex < rleBytes.length) {
      const runLength = (rleBytes[byteIndex + 1] << 8) | rleBytes[byteIndex];
      const block = this.blockFromBytes(rleBytes, byteIndex + 2);
      const blockToAssign = block.type === 0 ? undefined : block;

      const endIndex = blockIndex + runLength;
      while (blockIndex < endIndex) {
        const x = Math.floor(blockIndex / yzDim);
        const y = Math.floor((blockIndex % yzDim) / zDim);
        const z = blockIndex % zDim;
        if (x < xDim && y < yDim && z < zDim) {
          blocks[x][y][z] = blockToAssign;
        }
        blockIndex++;
      }

      byteIndex += 4;
    }
  }

  private copyBlocksArray(
    source: (Block | undefined)[][][],
    target: (Block | undefined)[][][]
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;
    for (let x = 0; x < xDim; x++) {
      for (let y = 0; y < yDim; y++) {
        for (let z = 0; z < zDim; z++) {
          target[x][y][z] = source[x]?.[y]?.[z];
        }
      }
    }
  }

  private addLayerToBlocks(
    layer: Layer,
    blocks: (Block | undefined)[][][]
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;

    if (layer.xDim !== xDim || layer.yDim !== yDim || layer.zDim !== zDim) {
      return;
    }

    const yzDim = yDim * zDim;
    let byteIndex = 0;
    let blockIndex = 0;

    while (byteIndex < layer.voxels.length) {
      const runLength = (layer.voxels[byteIndex + 1] << 8) | layer.voxels[byteIndex];
      const block = this.blockFromBytes(layer.voxels, byteIndex + 2);

      if (block.type !== 0) {
        const endIndex = blockIndex + runLength;
        while (blockIndex < endIndex) {
          const x = Math.floor(blockIndex / yzDim);
          const y = Math.floor((blockIndex % yzDim) / zDim);
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

  private blockFromBytes(bytes: Uint8Array, offset: number): Block {
    const combined = (bytes[offset] << 8) | bytes[offset + 1];
    const type = combined >> 6;
    const rotation = combined & 0x07;

    return { type, rotation };
  }

  update = async (
    layers: Layer[],
    previewBlocks: (Block | undefined)[][][],
    buildMode: BlockModificationMode,
    blocks: ProjectBlocks,
    atlas: Atlas
  ) => {
    const updateId = ++this.currentUpdateId;

    try {
      const visibleLayers = layers.filter((layer) => layer.visible);

      if (visibleLayers.length === 0) {
        this.clearBlocks(this.realBlocks);
      } else {
        const firstLayer = visibleLayers[0];
        this.decompressBlocksInto(firstLayer.voxels, this.realBlocks);

        if (updateId !== this.currentUpdateId) return;

        for (let i = 1; i < visibleLayers.length; i++) {
          this.addLayerToBlocks(visibleLayers[i], this.realBlocks);
          if (updateId !== this.currentUpdateId) return;
        }
      }

      this.copyBlocksArray(previewBlocks, this.previewBlocks);

      if (updateId !== this.currentUpdateId) return;

      findExteriorFaces(
        this.realBlocks,
        this.previewBlocks,
        buildMode,
        atlas,
        blocks,
        this.dimensions,
        this.meshArrays,
        this.previewMeshArrays
      );

      if (updateId !== this.currentUpdateId) return;

      this.updateMesh(this.realBlocks, this.previewBlocks, buildMode, atlas);
      this.updatePreviewMesh(buildMode, atlas);
    } catch (error) {
      console.error(`[LayerMesh] Update ${updateId} failed:`, error);
      throw error;
    }
  };
  private updateMesh(
    realBlocks: (Block | undefined)[][][],
    previewBlocks: (Block | undefined)[][][],
    previewMode: BlockModificationMode,
    atlas: Atlas
  ): void {
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
      new THREE.BufferAttribute(this.meshArrays.getVertices(), 3)
    );
    this.geometry.setAttribute("normal", new THREE.BufferAttribute(this.meshArrays.getNormals(), 3));
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(this.meshArrays.getUVs(), 2));
    this.geometry.setAttribute("aochannel", new THREE.BufferAttribute(this.meshArrays.getAO(), 1));
    this.geometry.setIndex(new THREE.BufferAttribute(this.meshArrays.getIndices(), 1));
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.aochannel.needsUpdate = true;
    if (this.geometry.index) {
      this.geometry.index.needsUpdate = true;
    }

    const center = new THREE.Vector3(
      this.dimensions.x / 2,
      this.dimensions.y / 2,
      this.dimensions.z / 2
    );
    const radius = Math.sqrt(
      (this.dimensions.x / 2) ** 2 +
      (this.dimensions.y / 2) ** 2 +
      (this.dimensions.z / 2) ** 2
    );
    this.geometry.boundingSphere = new THREE.Sphere(center, radius);
  }

  private updatePreviewMesh(
    buildMode: BlockModificationMode,
    atlas: Atlas
  ): void {
    if (!this.previewMesh) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(this.textureAtlas!, 1);
      this.previewMesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.previewMesh);
    }

    this.previewMesh?.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.previewMeshArrays.getVertices(), 3)
    );
    this.previewMesh?.geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(this.previewMeshArrays.getNormals(), 3)
    );
    this.previewMesh?.geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(this.previewMeshArrays.getUVs(), 2)
    );
    this.previewMesh?.geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(this.previewMeshArrays.getAO(), 1)
    );
    this.previewMesh?.geometry.setIndex(new THREE.BufferAttribute(this.previewMeshArrays.getIndices(), 1));

    this.previewMesh!.visible =
      buildMode.tag === BlockModificationMode.Build.tag || buildMode.tag === BlockModificationMode.Paint.tag;
    this.previewMesh!.layers.set(
      buildMode.tag === BlockModificationMode.Erase.tag || buildMode.tag === BlockModificationMode.Paint.tag
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

    const center = new THREE.Vector3(
      this.dimensions.x / 2,
      this.dimensions.y / 2,
      this.dimensions.z / 2
    );
    const radius = Math.sqrt(
      (this.dimensions.x / 2) ** 2 +
      (this.dimensions.y / 2) ** 2 +
      (this.dimensions.z / 2) ** 2
    );
    this.previewMesh!.geometry.boundingSphere = new THREE.Sphere(center, radius);
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