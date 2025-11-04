import * as THREE from "three";
import {
  Vector3,
  Chunk as DbChunk,
  Layer,
} from "@/module_bindings";
import {
  isBlockPresent,
  decompressVoxelDataInto,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import { ExteriorFacesFinder } from "./find-exterior-faces";
import { createVoxelMaterial } from "./shader";
import { MeshArrays } from "./mesh-arrays";
import { VoxelFrame } from "./voxel-frame";

export const CHUNK_SIZE = 32;

type MeshType = "main" | "preview";

interface MeshData {
  mesh: THREE.Mesh | null;
  meshArrays: MeshArrays;
}

export type DecompressedChunk = Omit<DbChunk, "voxels"> & { voxels: Uint8Array };

export class Chunk {
  private scene: THREE.Scene;
  public readonly minPos: Vector3;
  public readonly size: Vector3;
  private layerChunks: (DecompressedChunk | null)[];
  private renderedBlocks: Uint8Array;
  private blocksToRender: Uint8Array;

  // Mesh-related properties
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private meshes: Record<MeshType, MeshData>;
  private voxelData: Uint8Array[][];
  private facesFinder: ExteriorFacesFinder;

  constructor(
    scene: THREE.Scene,
    minPos: Vector3,
    size: Vector3,
    maxLayers: number
  ) {
    this.scene = scene;
    this.minPos = minPos;
    this.size = size;
    
    this.layerChunks = new Array(maxLayers).fill(null);

    const totalVoxels = size.x * size.y * size.z;
    this.renderedBlocks = new Uint8Array(totalVoxels);
    this.blocksToRender = new Uint8Array(totalVoxels);

    const maxFaces = totalVoxels * 6;
    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;

    this.meshes = {
      main: {
        mesh: null,
        meshArrays: new MeshArrays(maxVertices, maxIndices),
      },
      preview: {
        mesh: null,
        meshArrays: new MeshArrays(maxVertices, maxIndices),
      },
    };

    this.voxelData = [];
    for (let x = 0; x < size.x; x++) {
      this.voxelData[x] = [];
      for (let y = 0; y < size.y; y++) {
        this.voxelData[x][y] = new Uint8Array(size.z);
      }
    }

    const maxDimension = Math.max(size.x, size.y, size.z);
    this.facesFinder = new ExteriorFacesFinder(maxDimension);
  }

  public setLayerChunk(layerIndex: number, chunk: DbChunk | null): void {
    if (chunk === null) {
      this.layerChunks[layerIndex] = null;
      return;
    }

    const existing = this.layerChunks[layerIndex];
    const voxels = decompressVoxelDataInto(chunk.voxels, existing?.voxels);
    this.layerChunks[layerIndex] = {
      ...chunk,
      voxels,
    };
  }

  /**
   * Get the chunk data for a specific layer
   */
  public getLayerChunk(layerIndex: number): DecompressedChunk | null {
    return this.layerChunks[layerIndex] || null;
  }

  /**
   * Check if this chunk has any data
   */
  public isEmpty(): boolean {
    return this.layerChunks.every(chunk => chunk === null);
  }

  public applyOptimisticRect(
    layerIndex: number,
    mode: { tag: string },
    positions: Vector3[],
    blockType: number
  ): void {
    const layerChunk = this.layerChunks[layerIndex];
    if (!layerChunk) return;

    for (const worldPos of positions) {
      // Convert world position to local chunk position
      const localX = worldPos.x - this.minPos.x;
      const localY = worldPos.y - this.minPos.y;
      const localZ = worldPos.z - this.minPos.z;

      // Check bounds
      if (localX < 0 || localX >= this.size.x ||
          localY < 0 || localY >= this.size.y ||
          localZ < 0 || localZ >= this.size.z) {
        continue;
      }

      const index = localX * this.size.y * this.size.z + localY * this.size.z + localZ;

      switch (mode.tag) {
        case "Attach":
          layerChunk.voxels[index] = blockType;
          break;
        case "Erase":
          layerChunk.voxels[index] = 0;
          break;
        case "Paint":
          if (layerChunk.voxels[index] !== 0) {
            layerChunk.voxels[index] = blockType;
          }
          break;
      }
    }
  }

  private copyChunkData(blocks: Uint8Array): void {
    for (let x = 0; x < this.size.x; x++) {
      for (let y = 0; y < this.size.y; y++) {
        for (let z = 0; z < this.size.z; z++) {
          const blockIndex = x * this.size.y * this.size.z + y * this.size.z + z;
          this.voxelData[x][y][z] = blocks[blockIndex];
        }
      }
    }
  }

  public setTextureAtlas = (atlasData: AtlasData) => {
    if (this.material) {
      this.material.uniforms.map.value = atlasData.texture;
      this.material.needsUpdate = true;
    }
    
    Object.values(this.meshes).forEach((meshData) => {
      if (meshData.mesh?.material) {
        (meshData.mesh.material as THREE.ShaderMaterial).uniforms.map.value =
          atlasData.texture;
        (meshData.mesh.material as THREE.ShaderMaterial).needsUpdate = true;
      }
    });
  };

  public getMesh(): THREE.Mesh | null {
    return this.meshes.main.mesh;
  }

  private clearBlocks(blocks: Uint8Array) {
    blocks.fill(0);
  }

  private addLayerChunkToBlocks(
    layerChunk: DecompressedChunk,
    blocks: Uint8Array
  ): void {
    // Add this layer's voxel data to the composite blocks
    for (let i = 0; i < blocks.length && i < layerChunk.voxels.length; i++) {
      if (isBlockPresent(layerChunk.voxels[i])) {
        blocks[i] = layerChunk.voxels[i];
      }
    }
  }

  private updateMeshGeometry(
    meshType: MeshType,
    meshArrays: MeshArrays
  ): void {
    const meshData = this.meshes[meshType];
    if (!meshData.mesh) return;

    const geometry = meshData.mesh.geometry;
    
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(meshArrays.getVertices(), 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(meshArrays.getNormals(), 3)
    );
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(meshArrays.getUVs(), 2)
    );
    geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(meshArrays.getAO(), 1)
    );
    geometry.setAttribute(
      "isSelected",
      new THREE.BufferAttribute(meshArrays.getIsSelected(), 1)
    );
    geometry.setIndex(
      new THREE.BufferAttribute(meshArrays.getIndices(), 1)
    );

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.aochannel.needsUpdate = true;
    geometry.attributes.isSelected.needsUpdate = true;
    if (geometry.index) {
      geometry.index.needsUpdate = true;
    }

    const center = new THREE.Vector3(
      this.size.x / 2,
      this.size.y / 2,
      this.size.z / 2
    );
    const radius = Math.sqrt(
      (this.size.x / 2) ** 2 +
        (this.size.y / 2) ** 2 +
        (this.size.z / 2) ** 2
    );
    geometry.boundingSphere = new THREE.Sphere(center, radius);
  }

  private updateMainMesh = (atlasData: AtlasData): void => {
    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = createVoxelMaterial(atlasData.texture);
      this.meshes.main.mesh = new THREE.Mesh(this.geometry, this.material);
      this.meshes.main.mesh.castShadow = true;
      this.meshes.main.mesh.receiveShadow = true;

      // Position the mesh at the chunk's world position
      this.meshes.main.mesh.position.set(this.minPos.x, this.minPos.y, this.minPos.z);

      this.scene.add(this.meshes.main.mesh);
    }

    this.updateMeshGeometry("main", this.meshes.main.meshArrays);
  };

  private updatePreviewMesh = (atlasData: AtlasData): void => {
    if (!this.meshes.preview.mesh) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(atlasData.texture, 1);
      this.meshes.preview.mesh = new THREE.Mesh(geometry, material);

      this.meshes.preview.mesh.position.set(this.minPos.x, this.minPos.y, this.minPos.z);

      this.scene.add(this.meshes.preview.mesh);
    }

    this.updateMeshGeometry("preview", this.meshes.preview.meshArrays);
  };

  private updateMeshes = (atlasData: AtlasData) => {
    this.facesFinder.findExteriorFaces(
      this.voxelData,
      atlasData.texture?.image.width,
      atlasData.blockAtlasMappings,
      this.size,
      this.meshes.main.meshArrays,
      this.meshes.preview.meshArrays,
      new VoxelFrame(this.size), // Empty preview frame for now
      new VoxelFrame(this.size), // Empty selection frame for now
      false
    );

    this.updateMainMesh(atlasData);
    this.updatePreviewMesh(atlasData);
  };

  /**
   * Update the chunk's mesh based on visible layers
   */
  update = (
    visibleLayerIndices: number[],
    atlasData: AtlasData
  ) => {
    try {
      // Build composite voxel data from visible layers
      this.clearBlocks(this.blocksToRender);

      // Sort layers from bottom to top (lowest index first)
      const sortedLayers = [...visibleLayerIndices].sort((a, b) => a - b);

      for (const layerIndex of sortedLayers) {
        const layerChunk = this.layerChunks[layerIndex];
        if (layerChunk) {
          this.addLayerChunkToBlocks(layerChunk, this.blocksToRender);
        }
      }

      // Check if any blocks changed
      let hasChanges = false;
      for (let i = 0; i < this.blocksToRender.length; i++) {
        if (this.blocksToRender[i] !== this.renderedBlocks[i]) {
          hasChanges = true;
          break;
        }
      }

      // Update mesh if there are changes
      if (hasChanges) {
        this.copyChunkData(this.blocksToRender);
        this.updateMeshes(atlasData);
      }

      this.renderedBlocks.set(this.blocksToRender);
    } catch (error) {
      console.error(`[Chunk] Update failed:`, error);
      throw error;
    }
  };

  dispose = () => {
    // Dispose mesh resources
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    Object.values(this.meshes).forEach((meshData) => {
      if (meshData.mesh) {
        this.scene.remove(meshData.mesh);
        meshData.mesh.geometry.dispose();
        (meshData.mesh.material as THREE.Material).dispose();
        meshData.mesh = null;
      }
    });
  };
}
