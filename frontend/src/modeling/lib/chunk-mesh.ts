import * as THREE from "three";
import { BlockModificationMode, Vector3 } from "@/module_bindings";
import { findExteriorFaces } from "./find-exterior-faces";
import { createVoxelMaterial } from "./shader";
import { MeshArrays } from "./mesh-arrays";
import { layers } from "./layers";

export const CHUNK_SIZE = 16;

export class ChunkMesh {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private previewMesh: THREE.Mesh | null = null;
  private textureAtlas: THREE.Texture | null = null;

  private meshArrays: MeshArrays;
  private previewMeshArrays: MeshArrays;
  private chunkX: number;
  private chunkY: number;
  private chunkZ: number;
  private chunkDimensions: Vector3;
  private worldDimensions: Vector3;
  private voxelData: Uint32Array[][];

  constructor(
    scene: THREE.Scene,
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    chunkDimensions: Vector3,
    worldDimensions: Vector3,
    textureAtlas: THREE.Texture | null = null
  ) {
    this.scene = scene;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.chunkDimensions = chunkDimensions;
    this.worldDimensions = worldDimensions;
    this.textureAtlas = textureAtlas;

    const maxFaces =
      chunkDimensions.x * chunkDimensions.y * chunkDimensions.z * 6;
    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;

    this.meshArrays = new MeshArrays(maxVertices, maxIndices);
    this.previewMeshArrays = new MeshArrays(maxVertices, maxIndices);

    this.voxelData = [];
    for (let x = 0; x < chunkDimensions.x; x++) {
      this.voxelData[x] = [];
      for (let y = 0; y < chunkDimensions.y; y++) {
        this.voxelData[x][y] = new Uint32Array(chunkDimensions.z);
      }
    }
  }

  public getMesh(): THREE.Mesh | null {
    return this.mesh;
  }

  getChunkDimensions(): Vector3 {
    return this.chunkDimensions;
  }

  setVoxel(x: number, y: number, z: number, value: number): void {
    if (
      x >= 0 &&
      x < this.chunkDimensions.x &&
      y >= 0 &&
      y < this.chunkDimensions.y &&
      z >= 0 &&
      z < this.chunkDimensions.z
    ) {
      this.voxelData[x][y][z] = value;
    }
  }

  getVoxel(x: number, y: number, z: number): number {
    if (
      x >= 0 &&
      x < this.chunkDimensions.x &&
      y >= 0 &&
      y < this.chunkDimensions.y &&
      z >= 0 &&
      z < this.chunkDimensions.z
    ) {
      return this.voxelData[x][y][z];
    }
    return 0;
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

  update = (
    buildMode: BlockModificationMode,
    blockAtlasMappings: number[][]
  ) => {
    if (!this.textureAtlas) return;

    findExteriorFaces(
      this.voxelData,
      this.textureAtlas.image.width,
      blockAtlasMappings,
      this.chunkDimensions,
      this.meshArrays,
      this.previewMeshArrays,
      buildMode.tag === BlockModificationMode.Erase.tag
    );

    this.updateMesh();
    this.updatePreviewMesh(buildMode);
  };

  private updateMesh = (): void => {
    if (!this.textureAtlas) return;

    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = createVoxelMaterial(this.textureAtlas);
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;

      this.mesh.position.set(
        this.chunkX * CHUNK_SIZE,
        this.chunkY * CHUNK_SIZE,
        this.chunkZ * CHUNK_SIZE
      );

      this.scene.add(this.mesh);
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.meshArrays.getVertices(), 3)
    );
    this.geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(this.meshArrays.getNormals(), 3)
    );
    this.geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(this.meshArrays.getUVs(), 2)
    );
    this.geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(this.meshArrays.getAO(), 1)
    );
    this.geometry.setIndex(
      new THREE.BufferAttribute(this.meshArrays.getIndices(), 1)
    );

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.attributes.aochannel.needsUpdate = true;
    if (this.geometry.index) {
      this.geometry.index.needsUpdate = true;
    }

    const center = new THREE.Vector3(
      this.chunkDimensions.x / 2,
      this.chunkDimensions.y / 2,
      this.chunkDimensions.z / 2
    );
    const radius = Math.sqrt(
      (this.chunkDimensions.x / 2) ** 2 +
        (this.chunkDimensions.y / 2) ** 2 +
        (this.chunkDimensions.z / 2) ** 2
    );
    this.geometry.boundingSphere = new THREE.Sphere(center, radius);
  };

  private updatePreviewMesh = (buildMode: BlockModificationMode): void => {
    if (!this.textureAtlas) return;

    if (!this.previewMesh) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(this.textureAtlas, 1);
      this.previewMesh = new THREE.Mesh(geometry, material);

      this.previewMesh.position.set(
        this.chunkX * CHUNK_SIZE,
        this.chunkY * CHUNK_SIZE,
        this.chunkZ * CHUNK_SIZE
      );

      this.scene.add(this.previewMesh);
    }

    this.previewMesh.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.previewMeshArrays.getVertices(), 3)
    );
    this.previewMesh.geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(this.previewMeshArrays.getNormals(), 3)
    );
    this.previewMesh.geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(this.previewMeshArrays.getUVs(), 2)
    );
    this.previewMesh.geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(this.previewMeshArrays.getAO(), 1)
    );
    this.previewMesh.geometry.setIndex(
      new THREE.BufferAttribute(this.previewMeshArrays.getIndices(), 1)
    );

    this.previewMesh.visible =
      buildMode.tag === BlockModificationMode.Build.tag ||
      buildMode.tag === BlockModificationMode.Paint.tag;
    this.previewMesh.layers.set(
      buildMode.tag === BlockModificationMode.Build.tag
        ? layers.ghost
        : layers.raycast
    );

    this.previewMesh.geometry.attributes.position.needsUpdate = true;
    this.previewMesh.geometry.attributes.normal.needsUpdate = true;
    this.previewMesh.geometry.attributes.uv.needsUpdate = true;
    this.previewMesh.geometry.attributes.aochannel.needsUpdate = true;
    if (this.previewMesh.geometry.index) {
      this.previewMesh.geometry.index.needsUpdate = true;
    }

    const center = new THREE.Vector3(
      this.chunkDimensions.x / 2,
      this.chunkDimensions.y / 2,
      this.chunkDimensions.z / 2
    );
    const radius = Math.sqrt(
      (this.chunkDimensions.x / 2) ** 2 +
        (this.chunkDimensions.y / 2) ** 2 +
        (this.chunkDimensions.z / 2) ** 2
    );
    this.previewMesh.geometry.boundingSphere = new THREE.Sphere(center, radius);
  };

  dispose = () => {
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
      this.previewMesh.geometry.dispose();
      (this.previewMesh.material as THREE.Material).dispose();
      this.previewMesh = null;
    }
  };
}
