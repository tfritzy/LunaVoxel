import * as THREE from "three";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import {
  isBlockVisible,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import { ExteriorFacesFinder } from "./find-exterior-faces";
import { createVoxelMaterial } from "./shader";
import { MeshArrays } from "./mesh-arrays";
import { VoxelFrame } from "./voxel-frame";
import { WasmExteriorFacesFinderWrapper, isWasmReady, initWasm } from "./find-exterior-faces-wasm";

initWasm();

type SelectionFrameData = {
  minPos: Vector3;
  dimensions: Vector3;
  voxelData: Uint8Array;
};

export type SelectionData = {
  object: number;
  frame: SelectionFrameData;
  offset: Vector3;
};

interface MeshData {
  mesh: THREE.Mesh | null;
  meshArrays: MeshArrays;
}

export type ObjectChunk = {
  voxels: Uint8Array;
};

export class Chunk {
  private scene: THREE.Scene;
  public readonly minPos: Vector3;
  public readonly size: Vector3;
  private objectChunks: (ObjectChunk | null)[];
  private renderedBlocks: Uint8Array;
  private blocksToRender: Uint8Array;
  private selectionFrames: Map<string, SelectionData> = new Map();
  private mergedSelectionFrame: VoxelFrame;
  private previewBuffer: Uint8Array;
  private worldDimensions: Vector3;
  private previewDirty: boolean = false;
  private previewAccMinX: number = -1;
  private previewAccMinY: number = -1;
  private previewAccMinZ: number = -1;
  private previewAccMaxX: number = -1;
  private previewAccMaxY: number = -1;
  private previewAccMaxZ: number = -1;
  private atlasData: AtlasData | undefined;
  private atlasChanged: boolean = false;
  private getMode: () => BlockModificationMode;
  private getObjectVisible: (objectIndex: number) => boolean;

  // Mesh-related properties
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private meshData: MeshData;
  private voxelData: Uint8Array;
  private facesFinder: ExteriorFacesFinder;
  private wasmFacesFinder: WasmExteriorFacesFinderWrapper;

  constructor(
    scene: THREE.Scene,
    minPos: Vector3,
    size: Vector3,
    maxObjects: number,
    atlasData: AtlasData | undefined,
    getMode: () => BlockModificationMode,
    getObjectVisible: (objectIndex: number) => boolean,
    previewBuffer: Uint8Array,
    worldDimensions: Vector3
  ) {
    this.scene = scene;
    this.minPos = minPos;
    this.size = size;
    this.atlasData = atlasData;
    this.getMode = getMode;
    this.getObjectVisible = getObjectVisible;
    this.previewBuffer = previewBuffer;
    this.worldDimensions = worldDimensions;

    this.objectChunks = new Array(maxObjects).fill(null);

    const totalVoxels = size.x * size.y * size.z;
    this.renderedBlocks = new Uint8Array(totalVoxels);
    this.blocksToRender = new Uint8Array(totalVoxels);
    this.mergedSelectionFrame = new VoxelFrame(size);

    const maxFaces = totalVoxels * 6;
    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;

    this.meshData = {
      mesh: null,
      meshArrays: new MeshArrays(maxVertices, maxIndices),
    };

    this.voxelData = new Uint8Array(totalVoxels);

    const maxDimension = Math.max(size.x, size.y, size.z);
    this.facesFinder = new ExteriorFacesFinder(maxDimension);
    this.wasmFacesFinder = new WasmExteriorFacesFinderWrapper(maxDimension);
  }

  public setObjectChunk(objectIndex: number, voxels: Uint8Array | null): void {
    if (voxels === null) {
      this.objectChunks[objectIndex] = null;
      return;
    }
    this.objectChunks[objectIndex] = {
      voxels,
    };
    this.update();
  }

  public getObjectChunk(objectIndex: number): ObjectChunk | null {
    return this.objectChunks[objectIndex] || null;
  }

  public getVoxelAt(localX: number, localY: number, localZ: number): number {
    if (localX < 0 || localX >= this.size.x ||
        localY < 0 || localY >= this.size.y ||
        localZ < 0 || localZ >= this.size.z) {
      return 0;
    }
    const index = localX * this.size.y * this.size.z + localY * this.size.z + localZ;
    return this.blocksToRender[index];
  }

  public isEmpty(): boolean {
    return this.objectChunks.every((chunk) => chunk === null);
  }

  public applyOptimisticRect(
    objectIndex: number,
    mode: { tag: string },
    localMinX: number,
    localMaxX: number,
    localMinY: number,
    localMaxY: number,
    localMinZ: number,
    localMaxZ: number,
    blockType: number
  ): void {
    const objectChunk = this.objectChunks[objectIndex];
    if (!objectChunk) return;

    for (let x = localMinX; x <= localMaxX; x++) {
      for (let y = localMinY; y <= localMaxY; y++) {
        for (let z = localMinZ; z <= localMaxZ; z++) {
          const index = x * this.size.y * this.size.z + y * this.size.z + z;

          switch (mode.tag) {
            case "Attach":
              objectChunk.voxels[index] = blockType;
              break;
            case "Erase":
              objectChunk.voxels[index] = 0;
              break;
            case "Paint":
              if (objectChunk.voxels[index] !== 0) {
                objectChunk.voxels[index] = blockType;
              }
              break;
          }
        }
      }
    }

    this.update();
  }

  private copyChunkData(blocks: Uint8Array): void {
    this.voxelData.set(blocks);
  }

  public setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;
    this.atlasChanged = true;

    if (this.material) {
      this.material.uniforms.map.value = atlasData.texture;
      this.material.needsUpdate = true;
    }

    if (this.meshData.mesh?.material) {
      (this.meshData.mesh.material as THREE.ShaderMaterial).uniforms.map.value =
        atlasData.texture;
      (this.meshData.mesh.material as THREE.ShaderMaterial).needsUpdate = true;
    }

    this.update();
  };

  public getMesh(): THREE.Mesh | null {
    return this.meshData.mesh;
  }

  public expandPreviewBounds(worldMinX: number, worldMinY: number, worldMinZ: number, worldMaxX: number, worldMaxY: number, worldMaxZ: number): void {
    const localMinX = Math.max(0, worldMinX - this.minPos.x);
    const localMinY = Math.max(0, worldMinY - this.minPos.y);
    const localMinZ = Math.max(0, worldMinZ - this.minPos.z);
    const localMaxX = Math.min(this.size.x - 1, worldMaxX - this.minPos.x);
    const localMaxY = Math.min(this.size.y - 1, worldMaxY - this.minPos.y);
    const localMaxZ = Math.min(this.size.z - 1, worldMaxZ - this.minPos.z);

    if (this.previewAccMinX === -1) {
      this.previewAccMinX = localMinX;
      this.previewAccMinY = localMinY;
      this.previewAccMinZ = localMinZ;
      this.previewAccMaxX = localMaxX;
      this.previewAccMaxY = localMaxY;
      this.previewAccMaxZ = localMaxZ;
    } else {
      this.previewAccMinX = Math.min(this.previewAccMinX, localMinX);
      this.previewAccMinY = Math.min(this.previewAccMinY, localMinY);
      this.previewAccMinZ = Math.min(this.previewAccMinZ, localMinZ);
      this.previewAccMaxX = Math.max(this.previewAccMaxX, localMaxX);
      this.previewAccMaxY = Math.max(this.previewAccMaxY, localMaxY);
      this.previewAccMaxZ = Math.max(this.previewAccMaxZ, localMaxZ);
    }

    this.previewDirty = true;
  }

  public resetPreviewBounds(): void {
    this.previewAccMinX = -1;
    this.previewAccMinY = -1;
    this.previewAccMinZ = -1;
    this.previewAccMaxX = -1;
    this.previewAccMaxY = -1;
    this.previewAccMaxZ = -1;
    this.previewDirty = true;
  }

  public hasPreviewBounds(): boolean {
    return this.previewAccMinX !== -1;
  }

  public setSelectionFrame(identityId: string, selectionData: SelectionData | null): void {
    if (selectionData === null) {
      this.selectionFrames.delete(identityId);
    } else {
      this.selectionFrames.set(identityId, selectionData);
    }
  }

  public clearAllSelectionFrames(): void {
    this.selectionFrames.clear();
  }

  private clearBlocks(blocks: Uint8Array) {
    blocks.fill(0);
  }

  private addObjectChunkToBlocks(
    objectChunk: ObjectChunk,
    blocks: Uint8Array
  ): void {
    for (let i = 0; i < blocks.length && i < objectChunk.voxels.length; i++) {
      if (objectChunk.voxels[i] > 0) {
        blocks[i] = objectChunk.voxels[i];
        this.mergedSelectionFrame.setByIndex(i, 0);
      }
    }
  }

  private applySelectionForObject(objectIndex: number, blocks: Uint8Array): void {
    for (const selectionData of this.selectionFrames.values()) {
      if (selectionData.object !== objectIndex) continue;
      
      const selectionVoxels = selectionData.frame.voxelData;
      
      for (let i = 0; i < selectionVoxels.length && i < blocks.length; i++) {
        if (selectionVoxels[i] > 0) {
          if (blocks[i] === 0) {
            this.mergedSelectionFrame.setByIndex(i, selectionVoxels[i]);
          }
        }
      }
    }
  }

  private mergePreviewIntoVoxelData(blocks: Uint8Array): void {
    if (this.previewAccMinX === -1) return;

    const buildMode = this.getMode();
    const worldYZ = this.worldDimensions.y * this.worldDimensions.z;
    const worldZ = this.worldDimensions.z;

    const chunkMinX = this.minPos.x;
    const chunkMinY = this.minPos.y;
    const chunkMinZ = this.minPos.z;
    const sizeY = this.size.y;
    const sizeZ = this.size.z;

    const startLX = this.previewAccMinX;
    const endLX = this.previewAccMaxX;
    const startLY = this.previewAccMinY;
    const endLY = this.previewAccMaxY;
    const startLZ = this.previewAccMinZ;
    const endLZ = this.previewAccMaxZ;

    if (buildMode.tag === "Attach") {
      for (let lx = startLX; lx <= endLX; lx++) {
        const worldX = chunkMinX + lx;
        const srcXOff = worldX * worldYZ;
        const dstXOff = lx * sizeY * sizeZ;
        for (let ly = startLY; ly <= endLY; ly++) {
          const srcXYOff = srcXOff + (chunkMinY + ly) * worldZ;
          const dstXYOff = dstXOff + ly * sizeZ;
          for (let lz = startLZ; lz <= endLZ; lz++) {
            const pv = this.previewBuffer[srcXYOff + chunkMinZ + lz];
            if (pv !== 0) {
              const dstIdx = dstXYOff + lz;
              if (!isBlockVisible(blocks[dstIdx])) {
                blocks[dstIdx] = pv;
              }
            }
          }
        }
      }
    } else {
      for (let lx = startLX; lx <= endLX; lx++) {
        const worldX = chunkMinX + lx;
        const srcXOff = worldX * worldYZ;
        const dstXOff = lx * sizeY * sizeZ;
        for (let ly = startLY; ly <= endLY; ly++) {
          const srcXYOff = srcXOff + (chunkMinY + ly) * worldZ;
          const dstXYOff = dstXOff + ly * sizeZ;
          for (let lz = startLZ; lz <= endLZ; lz++) {
            const pv = this.previewBuffer[srcXYOff + chunkMinZ + lz];
            if (pv !== 0) {
              const dstIdx = dstXYOff + lz;
              if (isBlockVisible(blocks[dstIdx])) {
                blocks[dstIdx] = pv;
              }
            }
          }
        }
      }
    }
  }

  private updateMeshGeometry(meshArrays: MeshArrays): void {
    if (!this.meshData.mesh) return;

    const geometry = this.meshData.mesh.geometry;

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
    geometry.setIndex(new THREE.BufferAttribute(meshArrays.getIndices(), 1));

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
      (this.size.x / 2) ** 2 + (this.size.y / 2) ** 2 + (this.size.z / 2) ** 2
    );
    geometry.boundingSphere = new THREE.Sphere(center, radius);
  }

  private updateMesh = (atlasData: AtlasData): void => {
    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = createVoxelMaterial(atlasData.texture);
      this.meshData.mesh = new THREE.Mesh(this.geometry, this.material);
      this.meshData.mesh.castShadow = true;
      this.meshData.mesh.receiveShadow = true;

      this.meshData.mesh.position.set(
        this.minPos.x,
        this.minPos.y,
        this.minPos.z
      );

      this.scene.add(this.meshData.mesh);
    }

    this.updateMeshGeometry(this.meshData.meshArrays);
  };

  private updateMeshes = (atlasData: AtlasData) => {
    const finder = isWasmReady() ? this.wasmFacesFinder : this.facesFinder;
    finder.findExteriorFaces(
      this.voxelData,
      atlasData.texture?.image.width,
      atlasData.blockAtlasMapping,
      this.size,
      this.meshData.meshArrays,
      this.mergedSelectionFrame
    );

    this.updateMesh(atlasData);
  };

  private needsRender(): boolean {
    if (this.atlasChanged) {
      return true;
    }

    if (this.previewDirty) {
      return true;
    }

    for (let i = 0; i < this.blocksToRender.length; i++) {
      if (this.blocksToRender[i] !== this.renderedBlocks[i]) {
        return true;
      }
    }

    return false;
  }

  update = () => {
    try {
      this.clearBlocks(this.blocksToRender);
      this.mergedSelectionFrame.clear();

      for (let objectIndex = 0; objectIndex < this.objectChunks.length; objectIndex++) {
        const chunk = this.objectChunks[objectIndex];
        
        if (!this.getObjectVisible(objectIndex)) continue;

        if (chunk) {
          this.addObjectChunkToBlocks(chunk, this.blocksToRender);
        }
        
        this.applySelectionForObject(objectIndex, this.blocksToRender);
      }

      this.mergePreviewIntoVoxelData(this.blocksToRender);

      if (this.atlasData && this.needsRender()) {
        this.copyChunkData(this.blocksToRender);
        this.updateMeshes(this.atlasData);
        this.renderedBlocks.set(this.blocksToRender);
        this.atlasChanged = false;
        this.previewDirty = false;
      }
    } catch (error) {
      console.error(`[Chunk] Update failed:`, error);
      throw error;
    }
  };

  dispose = () => {
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }

    if (this.meshData.mesh) {
      this.scene.remove(this.meshData.mesh);
      this.meshData.mesh.geometry.dispose();
      (this.meshData.mesh.material as THREE.Material).dispose();
      this.meshData.mesh = null;
    }
  };
}
