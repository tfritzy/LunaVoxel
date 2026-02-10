import * as THREE from "three";
import type { BlockModificationMode, Vector3 } from "@/state/types";
import { isBlockPresent } from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import {
  createRaycastVoxelMaterial,
  createVoxelData3DTexture,
} from "./raycast-shader";
import { VoxelFrame } from "./voxel-frame";
import { FlatVoxelFrame } from "./flat-voxel-frame";

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

export type LayerChunk = {
  voxels: Uint8Array;
};

export class RaycastChunk {
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

  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.BoxGeometry | null = null;
  private voxelDataTexture: THREE.Data3DTexture | null = null;

  private voxelDataFlat: Uint8Array;

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
    this.voxelDataFlat = new Uint8Array(totalVoxels);
  }

  public setLayerChunk(layerIndex: number, voxels: Uint8Array | null): void {
    if (voxels === null) {
      this.layerChunks[layerIndex] = null;
      return;
    }
    this.layerChunks[layerIndex] = {
      voxels,
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
    }

    this.update();
  }

  public setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;

    if (this.material) {
      this.material.uniforms.textureAtlas.value = atlasData.texture;
      this.material.uniforms.atlasWidth.value = atlasData.texture?.image.width || 1;
      this.updateBlockMappings(atlasData);
      this.material.needsUpdate = true;
    }

    this.update();
  };

  private updateBlockMappings(atlasData: AtlasData): void {
    if (!this.material || !atlasData.blockAtlasMappings) return;

    const flatMappings = new Int32Array(256 * 6);
    for (let blockType = 0; blockType < atlasData.blockAtlasMappings.length; blockType++) {
      const blockMapping = atlasData.blockAtlasMappings[blockType];
      for (let face = 0; face < 6; face++) {
        flatMappings[blockType * 6 + face] = blockMapping[face];
      }
    }
    this.material.uniforms.blockMappings.value = flatMappings;
  }

  public getMesh(): THREE.Mesh | null {
    return this.mesh;
  }

  public clearPreviewData() {
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

  public setSelectionFrame(
    identityId: string,
    selectionData: SelectionData | null
  ): void {
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
    for (let i = 0; i < blocks.length && i < layerChunk.voxels.length; i++) {
      if (layerChunk.voxels[i] > 0) {
        blocks[i] = layerChunk.voxels[i];
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

  private convertBlocksTo3DTextureFormat(blocks: Uint8Array): void {
    for (let z = 0; z < this.size.z; z++) {
      for (let y = 0; y < this.size.y; y++) {
        for (let x = 0; x < this.size.x; x++) {
          const srcIndex = x * this.size.y * this.size.z + y * this.size.z + z;
          const dstIndex = x + y * this.size.x + z * this.size.x * this.size.y;
          this.voxelDataFlat[dstIndex] = blocks[srcIndex];
        }
      }
    }
  }

  private createMesh(atlasData: AtlasData): void {
    const blockMappings: number[] = [];
    if (atlasData.blockAtlasMappings) {
      for (const blockMapping of atlasData.blockAtlasMappings) {
        blockMappings.push(...blockMapping);
      }
    }

    this.geometry = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    
    this.voxelDataTexture = createVoxelData3DTexture(
      this.voxelDataFlat,
      this.size.x,
      this.size.y,
      this.size.z
    );

    this.material = createRaycastVoxelMaterial(
      this.voxelDataTexture,
      atlasData.texture,
      new THREE.Vector3(this.size.x, this.size.y, this.size.z),
      new THREE.Vector3(this.minPos.x, this.minPos.y, this.minPos.z),
      atlasData.texture?.image.width || 1,
      blockMappings
    );

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(
      this.minPos.x + this.size.x / 2,
      this.minPos.y + this.size.y / 2,
      this.minPos.z + this.size.z / 2
    );
    this.scene.add(this.mesh);
  }

  private updateVoxelTexture(): void {
    if (!this.voxelDataTexture) return;
    
    (this.voxelDataTexture.image.data as Uint8Array).set(this.voxelDataFlat);
    this.voxelDataTexture.needsUpdate = true;
  }

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

    if (
      this.renderedPreviewFrame &&
      !this.previewFrame.equals(this.renderedPreviewFrame)
    ) {
      return true;
    }

    return false;
  }

  update = () => {
    try {
      this.clearBlocks(this.blocksToRender);
      this.mergedSelectionFrame.clear();

      for (
        let layerIndex = 0;
        layerIndex < this.layerChunks.length;
        layerIndex++
      ) {
        const chunk = this.layerChunks[layerIndex];

        if (!this.getLayerVisible(layerIndex)) continue;

        if (chunk) {
          this.addLayerChunkToBlocks(chunk, this.blocksToRender);
        }

        this.applySelectionForLayer(layerIndex, this.blocksToRender);
      }

      this.updatePreviewState(this.blocksToRender);

      if (this.atlasData && this.needsRender()) {
        this.convertBlocksTo3DTextureFormat(this.blocksToRender);

        if (!this.mesh) {
          this.createMesh(this.atlasData);
        } else {
          this.updateVoxelTexture();
        }

        this.renderedBlocks.set(this.blocksToRender);

        if (this.previewFrame.isEmpty()) {
          this.renderedPreviewFrame = null;
        } else {
          this.renderedPreviewFrame = this.previewFrame.clone();
        }
      }
    } catch (error) {
      console.error(`[RaycastChunk] Update failed:`, error);
      throw error;
    }
  };

  dispose = () => {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.voxelDataTexture) {
      this.voxelDataTexture.dispose();
      this.voxelDataTexture = null;
    }
  };
}
