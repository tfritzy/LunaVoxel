import * as THREE from "three";
import type { Layer, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { AtlasData } from "@/lib/useAtlas";
import { SparseVoxelOctree } from "./sparse-voxel-octree";
import { OctreeMesher } from "./octree-mesher";
import { MeshArrays } from "./mesh-arrays";
import { createVoxelMaterial } from "./shader";

export class OctreeManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private layers: Layer[] = [];

  private renderTree: SparseVoxelOctree = new SparseVoxelOctree();

  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private meshArrays: MeshArrays;

  private mesher: OctreeMesher = new OctreeMesher();
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

    const maxVoxels = dimensions.x * dimensions.y * dimensions.z;
    const maxFaces = maxVoxels * 6;
    this.meshArrays = new MeshArrays(maxFaces * 4, maxFaces * 6);

    this.syncFromState();
    this.unsubscribe = this.stateStore.subscribe(this.onStateChange);
  }

  private onStateChange = () => {
    this.syncFromState();
    this.remesh();
  };

  private syncFromState(): void {
    const current = this.stateStore.getState();
    this.layers = current.layers
      .filter((layer) => layer.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    this.renderTree.clear();
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      const octree = current.layerOctrees.get(layer.id);
      if (octree) {
        this.renderTree.mergeFrom(octree);
      }
    }
  }

  public getLayer(layerIndex: number): Layer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
  }

  setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;

    if (this.material) {
      this.material.uniforms.map.value = atlasData.texture;
      this.material.needsUpdate = true;
    }

    this.remesh();
  };

  public writeToRenderTree(
    positions: { x: number; y: number; z: number; value: number }[]
  ): void {
    for (const pos of positions) {
      if (pos.value === 0) {
        this.renderTree.delete(pos.x, pos.y, pos.z);
      } else {
        this.renderTree.set(pos.x, pos.y, pos.z, pos.value);
      }
    }
    this.remesh();
  }

  public revertRenderTree(): void {
    this.syncFromState();
    this.remesh();
  }

  public getBlockAtPosition(position: THREE.Vector3, _layer: Layer): number | null {
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    const z = Math.floor(position.z);

    const current = this.stateStore.getState();
    const octree = current.layerOctrees.get(_layer.id);
    if (!octree) return 0;
    return octree.get(x, y, z) || 0;
  }

  public getRenderTree(): SparseVoxelOctree {
    return this.renderTree;
  }

  public getMesh(): THREE.Mesh | null {
    return this.mesh;
  }

  private remesh(): void {
    if (!this.atlasData) return;

    const textureWidth = this.atlasData.texture?.image?.width ?? 4;
    const blockAtlasMappings = this.atlasData.blockAtlasMappings;

    this.mesher.buildMesh(
      this.renderTree,
      textureWidth,
      blockAtlasMappings,
      this.meshArrays,
    );

    this.updateMesh();
  }

  private updateMesh(): void {
    if (!this.atlasData) return;

    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = createVoxelMaterial(this.atlasData.texture);
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
    }

    const geometry = this.mesh!.geometry;
    const meshArrays = this.meshArrays;

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

    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    this.geometry = null;
    this.material = null;
    this.renderTree.clear();
  };
}
