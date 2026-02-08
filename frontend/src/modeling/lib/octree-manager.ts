import * as THREE from "three";
import type { BlockModificationMode, Layer, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { CHUNK_SIZE } from "@/state/constants";
import { AtlasData } from "@/lib/useAtlas";
import { SparseVoxelOctree, PREVIEW_ERASE_SENTINEL } from "./sparse-voxel-octree";
import { OctreeMesher } from "./octree-mesher";
import { MeshArrays } from "./mesh-arrays";
import { createVoxelMaterial } from "./shader";
import { layers } from "./layers";

export class OctreeManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private layers: Layer[] = [];
  private layerVisibilityMap: Map<number, boolean> = new Map();
  private layerOctrees: Map<number, SparseVoxelOctree> = new Map();
  private renderTree: SparseVoxelOctree = new SparseVoxelOctree();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private unsubscribe?: () => void;
  private readonly maxLayers = 10;

  private mainMesh: THREE.Mesh | null = null;
  private mainGeometry: THREE.BufferGeometry | null = null;
  private mainMaterial: THREE.ShaderMaterial | null = null;
  private mainMeshArrays: MeshArrays;

  private previewMesh: THREE.Mesh | null = null;
  private previewMeshArrays: MeshArrays;

  private mesher: OctreeMesher = new OctreeMesher();

  private previewOverrides: Map<number, number> = new Map();

  private renderTreeDirty = true;

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    stateStore: StateStore,
    projectId: string,
    getMode: () => BlockModificationMode
  ) {
    this.scene = scene;
    this.dimensions = dimensions;
    this.stateStore = stateStore;
    this.projectId = projectId;
    this.getMode = getMode;

    const maxVoxels = dimensions.x * dimensions.y * dimensions.z;
    const maxFaces = maxVoxels * 6;
    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;

    this.mainMeshArrays = new MeshArrays(maxVertices, maxIndices);
    this.previewMeshArrays = new MeshArrays(maxVertices, maxIndices);

    this.handleStateChange();
    this.unsubscribe = this.stateStore.subscribe(this.handleStateChange);
  }

  private rebuildRenderTree(): void {
    this.renderTree.clear();
    for (let layerIndex = 0; layerIndex < this.maxLayers; layerIndex++) {
      if (!(this.layerVisibilityMap.get(layerIndex) ?? true)) continue;
      const octree = this.layerOctrees.get(layerIndex);
      if (octree) {
        this.renderTree.mergeFrom(octree);
      }
    }
    this.renderTreeDirty = false;
  }

  private handleStateChange = () => {
    const current = this.stateStore.getState();
    this.layers = current.layers
      .filter((layer) => layer.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    const oldVisibility = new Map(this.layerVisibilityMap);
    this.layerVisibilityMap.clear();
    for (const layer of this.layers) {
      this.layerVisibilityMap.set(layer.index, layer.visible);
    }

    for (const [idx, vis] of this.layerVisibilityMap) {
      if (oldVisibility.get(idx) !== vis) {
        this.renderTreeDirty = true;
      }
    }

    const layerIndexById = new Map(
      this.layers.map((layer) => [layer.id, layer.index])
    );

    const activeLayers = new Set<number>();
    for (const chunkData of current.chunks.values()) {
      if (chunkData.projectId !== this.projectId) continue;
      const layerIndex = layerIndexById.get(chunkData.layerId);
      if (layerIndex === undefined) continue;
      activeLayers.add(layerIndex);

      let octree = this.layerOctrees.get(layerIndex);
      if (!octree) {
        octree = new SparseVoxelOctree();
        this.layerOctrees.set(layerIndex, octree);
      }

      const minPos = chunkData.minPos;
      const sizeY = Math.min(CHUNK_SIZE, this.dimensions.y - minPos.y);
      const sizeZ = Math.min(CHUNK_SIZE, this.dimensions.z - minPos.z);
      const sizeX = Math.min(CHUNK_SIZE, this.dimensions.x - minPos.x);

      for (let lx = 0; lx < sizeX; lx++) {
        for (let ly = 0; ly < sizeY; ly++) {
          for (let lz = 0; lz < sizeZ; lz++) {
            const idx = lx * sizeY * sizeZ + ly * sizeZ + lz;
            const val = chunkData.voxels[idx];
            const wx = minPos.x + lx;
            const wy = minPos.y + ly;
            const wz = minPos.z + lz;
            if (val > 0) {
              octree.set(wx, wy, wz, val);
            } else {
              octree.delete(wx, wy, wz);
            }
          }
        }
      }
      this.renderTreeDirty = true;
    }

    for (const [idx] of this.layerOctrees) {
      if (!activeLayers.has(idx)) {
        this.layerOctrees.delete(idx);
        this.renderTreeDirty = true;
      }
    }

    if (this.renderTreeDirty) {
      this.rebuildRenderTree();
    }

    this.remesh();
  };

  public getLayer(layerIndex: number): Layer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
  }

  setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;

    if (this.mainMaterial) {
      this.mainMaterial.uniforms.map.value = atlasData.texture;
      this.mainMaterial.needsUpdate = true;
    }
    if (this.previewMesh?.material) {
      (this.previewMesh.material as THREE.ShaderMaterial).uniforms.map.value =
        atlasData.texture;
      (this.previewMesh.material as THREE.ShaderMaterial).needsUpdate = true;
    }

    this.remesh();
  };

  setPreview = (
    positions: { x: number; y: number; z: number; value: number }[]
  ) => {
    this.clearPreviewOverrides();

    const mode = this.getMode();

    for (const pos of positions) {
      const key = SparseVoxelOctree.packKey(pos.x, pos.y, pos.z);
      const currentValue = this.renderTree.getByKey(key);

      this.previewOverrides.set(key, currentValue);

      if (mode.tag === "Erase") {
        if (currentValue > 0 && currentValue !== PREVIEW_ERASE_SENTINEL) {
          this.renderTree.setByKey(key, PREVIEW_ERASE_SENTINEL);
        }
      } else {
        this.renderTree.setByKey(key, pos.value);
      }
    }

    this.remesh();
  };

  clearPreview = () => {
    this.clearPreviewOverrides();
    this.remesh();
  };

  private clearPreviewOverrides(): void {
    for (const [key, originalValue] of this.previewOverrides) {
      if (originalValue === 0) {
        this.renderTree.setByKey(key, 0);
      } else {
        this.renderTree.setByKey(key, originalValue);
      }
    }
    this.previewOverrides.clear();
  }

  public getBlockAtPosition(position: THREE.Vector3, _layer: Layer): number | null {
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    const z = Math.floor(position.z);

    const layerOctree = this.layerOctrees.get(_layer.index);
    if (!layerOctree) return 0;
    return layerOctree.get(x, y, z) || 0;
  }

  public applyOptimisticRect(
    layer: Layer,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    _rotation: number
  ) {
    void _rotation;
    if (layer.locked) return;

    const minX = Math.floor(Math.min(start.x, end.x));
    const maxX = Math.floor(Math.max(start.x, end.x));
    const minY = Math.floor(Math.min(start.y, end.y));
    const maxY = Math.floor(Math.max(start.y, end.y));
    const minZ = Math.floor(Math.min(start.z, end.z));
    const maxZ = Math.floor(Math.max(start.z, end.z));

    let octree = this.layerOctrees.get(layer.index);
    if (!octree) {
      octree = new SparseVoxelOctree();
      this.layerOctrees.set(layer.index, octree);
    }

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          switch (mode.tag) {
            case "Attach":
              octree.set(x, y, z, blockType);
              this.renderTree.set(x, y, z, blockType);
              break;
            case "Erase":
              octree.delete(x, y, z);
              this.renderTree.delete(x, y, z);
              break;
            case "Paint":
              if (octree.has(x, y, z)) {
                octree.set(x, y, z, blockType);
                this.renderTree.set(x, y, z, blockType);
              }
              break;
          }
        }
      }
    }

    this.remesh();
  }

  public getRenderTree(): SparseVoxelOctree {
    return this.renderTree;
  }

  public getMainMesh(): THREE.Mesh | null {
    return this.mainMesh;
  }

  private remesh(): void {
    if (!this.atlasData) return;

    const textureWidth = this.atlasData.texture?.image?.width ?? 4;
    const blockAtlasMappings = this.atlasData.blockAtlasMappings;

    this.mesher.buildMesh(
      this.renderTree,
      textureWidth,
      blockAtlasMappings,
      this.mainMeshArrays,
      (v) => v > 0 && v !== PREVIEW_ERASE_SENTINEL,
    );

    this.updateMainMesh();

    const mode = this.getMode();
    if (this.previewOverrides.size > 0) {
      if (mode.tag === "Erase") {
        this.previewMeshArrays.reset();
      } else {
        this.mesher.buildMesh(
          this.renderTree,
          textureWidth,
          blockAtlasMappings,
          this.previewMeshArrays,
          (v) => {
            return false;
          },
        );
        this.previewMeshArrays.reset();
      }
      this.updatePreviewMesh();
    } else {
      if (this.previewMesh) {
        this.previewMeshArrays.reset();
        this.updatePreviewMesh();
      }
    }
  }

  private updateMainMesh(): void {
    if (!this.atlasData) return;

    if (!this.mainGeometry) {
      this.mainGeometry = new THREE.BufferGeometry();
      this.mainMaterial = createVoxelMaterial(this.atlasData.texture);
      this.mainMesh = new THREE.Mesh(this.mainGeometry, this.mainMaterial);
      this.mainMesh.castShadow = true;
      this.mainMesh.receiveShadow = true;
      this.scene.add(this.mainMesh);
    }

    this.applyMeshArraysToGeometry(this.mainMesh!.geometry, this.mainMeshArrays);
  }

  private updatePreviewMesh(): void {
    if (!this.atlasData) return;

    if (!this.previewMesh) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(this.atlasData.texture, 1);
      this.previewMesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.previewMesh);
    }

    const mode = this.getMode();
    this.previewMesh.visible = mode.tag === "Attach" || mode.tag === "Paint";
    this.previewMesh.layers.set(
      mode.tag === "Attach" ? layers.ghost : layers.raycast
    );

    this.applyMeshArraysToGeometry(this.previewMesh.geometry, this.previewMeshArrays);
  }

  private applyMeshArraysToGeometry(
    geometry: THREE.BufferGeometry,
    meshArrays: MeshArrays
  ): void {
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

    const halfX = this.dimensions.x / 2;
    const halfY = this.dimensions.y / 2;
    const halfZ = this.dimensions.z / 2;
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(halfX, halfY, halfZ),
      Math.sqrt(halfX ** 2 + halfY ** 2 + halfZ ** 2)
    );
  }

  dispose = () => {
    this.unsubscribe?.();
    this.unsubscribe = undefined;

    if (this.mainMesh) {
      this.scene.remove(this.mainMesh);
      this.mainMesh.geometry.dispose();
      (this.mainMesh.material as THREE.Material).dispose();
      this.mainMesh = null;
    }
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh.geometry.dispose();
      (this.previewMesh.material as THREE.Material).dispose();
      this.previewMesh = null;
    }
    this.mainGeometry = null;
    this.mainMaterial = null;
    this.layerOctrees.clear();
    this.renderTree.clear();
    this.previewOverrides.clear();
  };
}
