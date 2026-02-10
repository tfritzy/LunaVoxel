import * as THREE from "three";
import type { BlockModificationMode, Layer, Vector3 } from "@/state/types";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";

export interface ILayerChunk {
  voxels: Uint8Array;
}

export interface IChunk {
  readonly minPos: Vector3;
  readonly size: Vector3;
  getMesh(): THREE.Mesh | null;
  getLayerChunk(layerIndex: number): ILayerChunk | null;
}

export interface IChunkManager {
  getChunks(): IChunk[];
  getLayer(layerIndex: number): Layer | undefined;
  setTextureAtlas(atlasData: AtlasData): void;
  setPreview(previewFrame: VoxelFrame): void;
  getBlockAtPosition(position: THREE.Vector3, layer: Layer): number | null;
  applyOptimisticRect(
    layer: Layer,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ): void;
  dispose(): void;
}
