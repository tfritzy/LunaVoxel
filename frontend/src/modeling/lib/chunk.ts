import * as THREE from "three";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import {
  isBlockPresent,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import { ExteriorFacesFinder } from "./find-exterior-faces";
import { createVoxelMaterial } from "./shader";
import { MeshArrays } from "./mesh-arrays";
import { VoxelFrame } from "./voxel-frame";
import { FlatVoxelFrame } from "./flat-voxel-frame";
import { layers } from "./layers";

type SelectionFrameData = {
  minPos: Vector3;
  dimensions: Vector3;
  voxelData: Uint8Array;
};

export type SelectionData = {
  layer: number;
  frame: SelectionFrameData;
  offset: Vector3;
};

type MeshType = "main" | "preview";

interface MeshData {
  mesh: THREE.Mesh | null;
  meshArrays: MeshArrays;
}

export type LayerChunk = {
  chunkData: import("@/state/types").ChunkData;
};

export class Chunk {
  private scene: THREE.Scene;
  public readonly minPos: Vector3;
  public readonly size: Vector3;
  private layerChunks: (LayerChunk | null)[];
  private renderedBlocks: Uint8Array;
  private blocksToRender: Uint8Array;
  private selectionFrames: Map<string, SelectionData> = new Map();
  private mergedSelectionFrame: FlatVoxelFrame;
  private previewFrame: VoxelFrame;
  private renderedPreviewFrame: VoxelFrame | null = null;
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private getLayerVisible: (layerIndex: number) => boolean;

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
    maxLayers: number,
    atlasData: AtlasData | undefined,
    getMode: () => BlockModificationMode,
    getLayerVisible: (layerIndex: number) => boolean
  ) {
    this.scene = scene;
    this.minPos = minPos;
    this.size = size;
    this.atlasData = atlasData;
    this.getMode = getMode;
    this.getLayerVisible = getLayerVisible;

    this.layerChunks = new Array(maxLayers).fill(null);

    const totalVoxels = size.x * size.y * size.z;
    this.renderedBlocks = new Uint8Array(totalVoxels);
    this.blocksToRender = new Uint8Array(totalVoxels);
    this.mergedSelectionFrame = new FlatVoxelFrame(size);
    this.previewFrame = new VoxelFrame(size);

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

  public setLayerChunk(layerIndex: number, chunkData: import("@/state/types").ChunkData | null): void {
    if (chunkData === null) {
      this.layerChunks[layerIndex] = null;
      return;
    }
    this.layerChunks[layerIndex] = {
      chunkData,
    };
    this.update();
  }

  public getLayerChunk(layerIndex: number): LayerChunk | null {
    return this.layerChunks[layerIndex] || null;
  }

  public isEmpty(): boolean {
    return this.layerChunks.every((chunk) => chunk === null);
  }

  public applyOptimisticRect(
    layerIndex: number,
    mode: { tag: string },
    localMinX: number,
    localMaxX: number,
    localMinY: number,
    localMaxY: number,
    localMinZ: number,
    localMaxZ: number,
    blockType: number
  ): void {
    const layerChunk = this.layerChunks[layerIndex];
    if (!layerChunk) return;

    for (let x = localMinX; x <= localMaxX; x++) {
      for (let y = localMinY; y <= localMaxY; y++) {
        for (let z = localMinZ; z <= localMaxZ; z++) {
          const index = x * this.size.y * this.size.z + y * this.size.z + z;

          switch (mode.tag) {
            case "Attach":
              layerChunk.chunkData.voxels[index] = blockType;
              break;
            case "Erase":
              layerChunk.chunkData.voxels[index] = 0;
              break;
            case "Paint":
              if (layerChunk.chunkData.voxels[index] !== 0) {
                layerChunk.chunkData.voxels[index] = blockType;
              }
              break;
          }
        }
      }
    }

    this.update();
  }

  private copyChunkData(blocks: Uint8Array): void {
    for (let x = 0; x < this.size.x; x++) {
      for (let y = 0; y < this.size.y; y++) {
        for (let z = 0; z < this.size.z; z++) {
          const blockIndex =
            x * this.size.y * this.size.z + y * this.size.z + z;
          this.voxelData[x][y][z] = blocks[blockIndex];
        }
      }
    }
  }

  public setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;

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

    this.update();
  };

  public getMesh(): THREE.Mesh | null {
    return this.meshes.main.mesh;
  }

  public clearPreviewData()
  {
    this.previewFrame.clear();
    this.update();
  }

  public setPreviewData(
    sourceFrame: VoxelFrame,
    sourceMinX: number,
    sourceMinY: number,
    sourceMinZ: number,
    sourceMaxX: number,
    sourceMaxY: number,
    sourceMaxZ: number
  ): void {
    this.previewFrame.clear();

    for (let worldX = sourceMinX; worldX < sourceMaxX; worldX++) {
      for (let worldY = sourceMinY; worldY < sourceMaxY; worldY++) {
        for (let worldZ = sourceMinZ; worldZ < sourceMaxZ; worldZ++) {
          const blockValue = sourceFrame.get(worldX, worldY, worldZ);
          if (blockValue !== 0) {
            const localX = worldX - this.minPos.x;
            const localY = worldY - this.minPos.y;
            const localZ = worldZ - this.minPos.z;
            this.previewFrame.set(localX, localY, localZ, blockValue);
          }
        }
      }
    }

    this.update();
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

  private addLayerChunkToBlocks(
    layerChunk: LayerChunk,
    blocks: Uint8Array
  ): void {
    for (let i = 0; i < blocks.length && i < layerChunk.chunkData.voxels.length; i++) {
      if (layerChunk.chunkData.voxels[i] > 0) {
        blocks[i] = layerChunk.chunkData.voxels[i];
        this.mergedSelectionFrame.setByIndex(i, 0);
      }
    }
  }

  private applySelectionForLayer(layerIndex: number, blocks: Uint8Array): void {
    for (const selectionData of this.selectionFrames.values()) {
      if (selectionData.layer !== layerIndex) continue;
      
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

  private updatePreviewState(blocks: Uint8Array): void {
    if (this.previewFrame.isEmpty()) return;

    const buildMode = this.getMode();
    const sizeY = this.size.y;
    const sizeZ = this.size.z;
    const sizeYZ = sizeY * sizeZ;

    if (buildMode.tag === "Attach") {
      for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
        const x = Math.floor(voxelIndex / sizeYZ);
        const y = Math.floor((voxelIndex % sizeYZ) / sizeZ);
        const z = voxelIndex % sizeZ;

        const previewBlockValue = this.previewFrame.get(x, y, z);
        if (previewBlockValue !== 0 && isBlockPresent(blocks[voxelIndex])) {
          this.previewFrame.set(x, y, z, 0);
        }
      }
    } else if (buildMode.tag === "Erase") {
      for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
        const previewBlockValue = this.previewFrame.get(
          Math.floor(voxelIndex / sizeYZ),
          Math.floor((voxelIndex % sizeYZ) / sizeZ),
          voxelIndex % sizeZ
        );

        if (previewBlockValue !== 0) {
          const realBlockValue = blocks[voxelIndex];
          const newValue = isBlockPresent(realBlockValue) ? realBlockValue : 0;
          if (newValue !== previewBlockValue) {
            this.previewFrame.set(
              Math.floor(voxelIndex / sizeYZ),
              Math.floor((voxelIndex % sizeYZ) / sizeZ),
              voxelIndex % sizeZ,
              newValue
            );
          }
        }
      }
    } else if (buildMode.tag === "Paint") {
      for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
        const x = Math.floor(voxelIndex / sizeYZ);
        const y = Math.floor((voxelIndex % sizeYZ) / sizeZ);
        const z = voxelIndex % sizeZ;

        const previewBlockValue = this.previewFrame.get(x, y, z);
        if (previewBlockValue !== 0 && !isBlockPresent(blocks[voxelIndex])) {
          this.previewFrame.set(x, y, z, 0);
        }
      }
    }
  }

  private updateMeshGeometry(meshType: MeshType, meshArrays: MeshArrays): void {
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

  private updateMainMesh = (atlasData: AtlasData): void => {
    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = createVoxelMaterial(atlasData.texture);
      this.meshes.main.mesh = new THREE.Mesh(this.geometry, this.material);
      this.meshes.main.mesh.castShadow = true;
      this.meshes.main.mesh.receiveShadow = true;

      this.meshes.main.mesh.position.set(
        this.minPos.x,
        this.minPos.y,
        this.minPos.z
      );

      this.scene.add(this.meshes.main.mesh);
    }

    this.updateMeshGeometry("main", this.meshes.main.meshArrays);
  };

  private updatePreviewMesh = (): void => {
    if (!this.meshes.preview.mesh && this.atlasData) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(this.atlasData.texture, 1);
      this.meshes.preview.mesh = new THREE.Mesh(geometry, material);

      this.meshes.preview.mesh.position.set(
        this.minPos.x,
        this.minPos.y,
        this.minPos.z
      );

      this.scene.add(this.meshes.preview.mesh);
    }

    const mode = this.getMode();
    console.log("Mode for preview mesh", mode);
    this.meshes.preview.mesh!.visible =
      mode.tag === "Attach" || mode.tag === "Paint";
    this.meshes.preview.mesh!.layers.set(
      mode.tag === "Attach" ? layers.ghost : layers.raycast
    );

    this.updateMeshGeometry("preview", this.meshes.preview.meshArrays);
  };

  private updateMeshes = (buildMode: BlockModificationMode, atlasData: AtlasData) => {
    this.facesFinder.findExteriorFaces(
      this.voxelData,
      atlasData.texture?.image.width,
      atlasData.blockAtlasMappings,
      this.size,
      this.meshes.main.meshArrays,
      this.meshes.preview.meshArrays,
      this.previewFrame,
      this.mergedSelectionFrame,
      buildMode.tag !== "Erase"
    );

    this.updateMainMesh(atlasData);
    this.updatePreviewMesh();
  };

  private needsRender(): boolean {
    for (let i = 0; i < this.blocksToRender.length; i++) {
      if (this.blocksToRender[i] !== this.renderedBlocks[i]) {
        return true;
      }
    }

    if (this.previewFrame.isEmpty() && this.renderedPreviewFrame === null) {
      return false;
    }

    if (this.previewFrame.isEmpty() !== (this.renderedPreviewFrame === null)) {
      return true;
    }

    if (this.renderedPreviewFrame && !this.previewFrame.equals(this.renderedPreviewFrame)) {
      return true;
    }

    return false;
  }

  update = () => {
    try {
      this.clearBlocks(this.blocksToRender);
      this.mergedSelectionFrame.clear();

      for (let layerIndex = 0; layerIndex < this.layerChunks.length; layerIndex++) {
        const chunk = this.layerChunks[layerIndex];
        
        if (!this.getLayerVisible(layerIndex)) continue;

        if (chunk) {
          this.addLayerChunkToBlocks(chunk, this.blocksToRender);
        }
        
        this.applySelectionForLayer(layerIndex, this.blocksToRender);
      }

      this.updatePreviewState(this.blocksToRender);

      if (this.atlasData && this.needsRender()) {
        this.copyChunkData(this.blocksToRender);
        this.updateMeshes(this.getMode(), this.atlasData);
        this.renderedBlocks.set(this.blocksToRender);

        if (this.previewFrame.isEmpty()) {
          this.renderedPreviewFrame = null;
        } else {
          this.renderedPreviewFrame = this.previewFrame.clone();
        }
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
