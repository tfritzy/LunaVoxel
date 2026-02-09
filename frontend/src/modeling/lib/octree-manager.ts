import * as THREE from "three";
import type { BlockModificationMode, Layer, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { AtlasData } from "@/lib/useAtlas";
import { SparseVoxelOctree, BLOCK_TYPE_MASK, INVISIBLE_FLAG } from "./sparse-voxel-octree";
import { OctreeMesher } from "./octree-mesher";
import { MeshArrays } from "./mesh-arrays";
import { createVoxelMaterial } from "./shader";

interface LayerMesh {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  meshArrays: MeshArrays;
  mesher: OctreeMesher;
}

export class OctreeManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private layers: Layer[] = [];

  private layerMeshes: Map<string, LayerMesh> = new Map();
  private previewTree: SparseVoxelOctree = new SparseVoxelOctree();
  private previewLayerId: string | null = null;

  private globalOccupancy: Uint8Array;
  private globalStrideX: number;
  private globalStrideY: number;

  private atlasData: AtlasData | undefined;
  private unsubscribe?: () => void;

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    stateStore: StateStore,
    projectId: string,
  ) {
    this.scene = scene;
    this.dimensions = dimensions;
    this.stateStore = stateStore;
    this.projectId = projectId;

    this.globalStrideY = dimensions.z;
    this.globalStrideX = dimensions.y * dimensions.z;
    this.globalOccupancy = new Uint8Array(dimensions.x * dimensions.y * dimensions.z);

    this.syncLayers();
    this.unsubscribe = this.stateStore.subscribe(this.onStateChange);
  }

  private onStateChange = () => {
    this.syncLayers();
    this.previewTree.clear();
    this.previewLayerId = null;
    this.remesh();
  };

  private syncLayers(): void {
    const current = this.stateStore.getState();
    this.layers = current.layers
      .filter((layer) => layer.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);
  }

  public getLayer(layerIndex: number): Layer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
  }

  setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;

    for (const lm of this.layerMeshes.values()) {
      lm.material.uniforms.map.value = atlasData.texture;
      lm.material.needsUpdate = true;
    }

    this.remesh();
  };

  public setPreview(
    mode: BlockModificationMode,
    layerIndex: number,
    positions: { x: number; y: number; z: number; value: number }[]
  ): void {
    const layer = this.getLayer(layerIndex);
    if (!layer) return;

    const current = this.stateStore.getState();
    const layerOctree = current.layerOctrees.get(layer.id);

    this.previewTree.clear();
    this.previewLayerId = layer.id;

    if (layerOctree) {
      this.previewTree.mergeFrom(layerOctree);
    }

    switch (mode.tag) {
      case "Attach":
        for (const pos of positions) {
          this.previewTree.set(pos.x, pos.y, pos.z, pos.value);
        }
        break;
      case "Paint":
        for (const pos of positions) {
          if (this.previewTree.has(pos.x, pos.y, pos.z)) {
            this.previewTree.set(pos.x, pos.y, pos.z, pos.value);
          }
        }
        break;
      case "Erase":
        for (const pos of positions) {
          if (this.previewTree.has(pos.x, pos.y, pos.z)) {
            const bt = SparseVoxelOctree.blockType(this.previewTree.get(pos.x, pos.y, pos.z));
            this.previewTree.set(pos.x, pos.y, pos.z, bt | INVISIBLE_FLAG);
          }
        }
        break;
    }

    this.remesh();
  }

  public clearPreview(): void {
    this.previewTree.clear();
    this.previewLayerId = null;
    this.remesh();
  }

  public getBlockAtPosition(position: THREE.Vector3, _layer: Layer): number | null {
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    const z = Math.floor(position.z);

    const current = this.stateStore.getState();
    const octree = current.layerOctrees.get(_layer.id);
    if (!octree) return 0;
    return SparseVoxelOctree.blockType(octree.get(x, y, z)) || 0;
  }

  public getLayerMeshes(): Map<string, THREE.Mesh> {
    const result = new Map<string, THREE.Mesh>();
    for (const [id, lm] of this.layerMeshes) {
      result.set(id, lm.mesh);
    }
    return result;
  }

  public getMesh(): THREE.Mesh | null {
    for (const lm of this.layerMeshes.values()) {
      if (lm.mesh.visible) return lm.mesh;
    }
    return null;
  }

  private remesh(): void {
    if (!this.atlasData) return;

    const textureWidth = this.atlasData.texture?.image?.width ?? 4;
    const blockAtlasMappings = this.atlasData.blockAtlasMappings;
    const current = this.stateStore.getState();

    this.globalOccupancy.fill(0);

    const activeLayerIds = new Set<string>();

    const sortedLayers = [...this.layers].sort((a, b) => b.index - a.index);

    for (const layer of sortedLayers) {
      activeLayerIds.add(layer.id);

      if (!layer.visible) {
        const lm = this.layerMeshes.get(layer.id);
        if (lm) lm.mesh.visible = false;
        continue;
      }

      let octree: SparseVoxelOctree;
      if (this.previewLayerId === layer.id && this.previewTree.size > 0) {
        octree = this.previewTree;
      } else {
        const stateOctree = current.layerOctrees.get(layer.id);
        if (!stateOctree || stateOctree.size === 0) {
          const lm = this.layerMeshes.get(layer.id);
          if (lm) lm.mesh.visible = false;
          continue;
        }
        octree = stateOctree;
      }

      const lm = this.getOrCreateLayerMesh(layer.id);
      lm.mesher.buildMesh(
        octree,
        textureWidth,
        blockAtlasMappings,
        lm.meshArrays,
        this.globalOccupancy,
        this.globalStrideX,
        this.globalStrideY,
      );
      this.applyMeshArrays(lm.geometry, lm.meshArrays);
      lm.mesh.visible = lm.meshArrays.vertexCount > 0;
    }

    for (const [id, lm] of this.layerMeshes) {
      if (!activeLayerIds.has(id)) {
        this.scene.remove(lm.mesh);
        lm.geometry.dispose();
        lm.material.dispose();
        this.layerMeshes.delete(id);
      }
    }
  }

  private getOrCreateLayerMesh(layerId: string): LayerMesh {
    let lm = this.layerMeshes.get(layerId);
    if (lm) return lm;

    const maxVoxels = this.dimensions.x * this.dimensions.y * this.dimensions.z;
    const maxFaces = maxVoxels * 6;
    const geometry = new THREE.BufferGeometry();
    const material = createVoxelMaterial(this.atlasData?.texture ?? null);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    lm = {
      mesh,
      geometry,
      material,
      meshArrays: new MeshArrays(maxFaces * 4, maxFaces * 6),
      mesher: new OctreeMesher(),
    };
    this.layerMeshes.set(layerId, lm);
    return lm;
  }

  private applyMeshArrays(geometry: THREE.BufferGeometry, meshArrays: MeshArrays): void {
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

    for (const lm of this.layerMeshes.values()) {
      this.scene.remove(lm.mesh);
      lm.geometry.dispose();
      lm.material.dispose();
    }
    this.layerMeshes.clear();
    this.previewTree.clear();
  };
}
