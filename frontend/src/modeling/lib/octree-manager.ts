import * as THREE from "three";
import type { BlockModificationMode, Layer, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";
import { MeshArrays } from "./mesh-arrays";
import { createVoxelMaterial } from "./shader";
import { OctreeMesher } from "./octree-mesher";
import { SparseVoxelOctree } from "./sparse-voxel-octree";
import { layers } from "./layers";

interface MeshData {
  mesh: THREE.Mesh | null;
  meshArrays: MeshArrays;
}

type MeshType = "main" | "preview";

export class OctreeManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private layers: Layer[] = [];
  private layerVisibilityMap: Map<number, boolean> = new Map();
  private layerOctrees: Map<string, SparseVoxelOctree> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private renderOctree: SparseVoxelOctree;
  private previewOctree: SparseVoxelOctree;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private meshes: Record<MeshType, MeshData>;
  private mesher: OctreeMesher;
  private unsubscribe?: () => void;

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
    this.renderOctree = new SparseVoxelOctree(dimensions);
    this.previewOctree = new SparseVoxelOctree(dimensions);
    this.mesher = new OctreeMesher();

    this.meshes = {
      main: {
        mesh: null,
        meshArrays: new MeshArrays(0, 0),
      },
      preview: {
        mesh: null,
        meshArrays: new MeshArrays(0, 0),
      },
    };

    this.handleStateChange();
    this.unsubscribe = this.stateStore.subscribe(this.handleStateChange);
  }

  private handleStateChange = () => {
    const current = this.stateStore.getState();
    this.layers = current.layers
      .filter((layer) => layer.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    this.layerVisibilityMap.clear();
    for (const layer of this.layers) {
      this.layerVisibilityMap.set(layer.index, layer.visible);
    }

    this.layerOctrees = current.layerOctrees;
    this.rebuildRenderOctree();
    this.updateMeshes();
  };

  private rebuildRenderOctree(): void {
    this.renderOctree.clear();

    for (const layer of this.layers) {
      if (!this.layerVisibilityMap.get(layer.index)) {
        continue;
      }

      const octree = this.layerOctrees.get(layer.id);
      if (!octree) {
        continue;
      }

      octree.forEachLeaf((leaf) => {
        if (leaf.value === 0) {
          return;
        }

        this.renderOctree.setRegion(
          leaf.minPos,
          { x: leaf.size, y: leaf.size, z: leaf.size },
          leaf.value
        );
      });
    }
  }

  /**
   * Allocate enough space for 6 faces per leaf (no culling).
   */
  private createMeshArrays(leafCount: number): MeshArrays {
    const maxFaces = leafCount * 6;
    const maxVertices = maxFaces * 4;
    const maxIndices = maxFaces * 6;
    return new MeshArrays(maxVertices, maxIndices);
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
      this.dimensions.x / 2,
      this.dimensions.y / 2,
      this.dimensions.z / 2
    );
    const radius = Math.sqrt(
      (this.dimensions.x / 2) ** 2 +
        (this.dimensions.y / 2) ** 2 +
        (this.dimensions.z / 2) ** 2
    );
    geometry.boundingSphere = new THREE.Sphere(center, radius);
  }

  private updateMainMesh(atlasData: AtlasData): void {
    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = createVoxelMaterial(atlasData.texture);
      this.meshes.main.mesh = new THREE.Mesh(this.geometry, this.material);
      this.meshes.main.mesh.castShadow = true;
      this.meshes.main.mesh.receiveShadow = true;

      this.scene.add(this.meshes.main.mesh);
    }

    this.updateMeshGeometry("main", this.meshes.main.meshArrays);
  }

  private updatePreviewMesh(): void {
    if (!this.meshes.preview.mesh && this.atlasData) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(this.atlasData.texture, 1);
      this.meshes.preview.mesh = new THREE.Mesh(geometry, material);
      this.scene.add(this.meshes.preview.mesh);
    }

    if (!this.meshes.preview.mesh) {
      return;
    }

    const mode = this.getMode();
    this.meshes.preview.mesh.visible =
      mode.tag === "Attach" || mode.tag === "Paint";
    this.meshes.preview.mesh.layers.set(
      mode.tag === "Attach" ? layers.ghost : layers.raycast
    );

    this.updateMeshGeometry("preview", this.meshes.preview.meshArrays);
  }

  private updateMeshes(): void {
    if (!this.atlasData) {
      return;
    }

    const textureWidth = this.atlasData.texture?.image.width ?? 1;

    const mainLeaves = this.renderOctree.countLeaves();
    const previewLeaves = this.previewOctree.countLeaves();

    this.meshes.main.meshArrays = this.createMeshArrays(mainLeaves);
    this.meshes.preview.meshArrays = this.createMeshArrays(previewLeaves);

    this.mesher.buildMesh(
      this.renderOctree,
      textureWidth,
      this.atlasData.blockAtlasMappings,
      this.meshes.main.meshArrays
    );

    this.mesher.buildMesh(
      this.previewOctree,
      textureWidth,
      this.atlasData.blockAtlasMappings,
      this.meshes.preview.meshArrays
    );

    this.updateMainMesh(this.atlasData);
    this.updatePreviewMesh();
  }

  public setTextureAtlas(atlasData: AtlasData): void {
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

    this.updateMeshes();
  }

  public setPreview(previewFrame: VoxelFrame): void {
    this.previewOctree.clear();

    if (!previewFrame.isEmpty()) {
      const minPos = previewFrame.getMinPos();
      const maxPos = previewFrame.getMaxPos();

      for (let x = minPos.x; x < maxPos.x; x++) {
        for (let y = minPos.y; y < maxPos.y; y++) {
          for (let z = minPos.z; z < maxPos.z; z++) {
            const value = previewFrame.get(x, y, z);
            if (value !== 0) {
              this.previewOctree.set(x, y, z, value);
            }
          }
        }
      }
    }

    this.updateMeshes();
  }

  public getLayer(layerIndex: number): Layer | undefined {
    return this.layers.find((layer) => layer.index === layerIndex);
  }

  public getBlockAtPosition(position: THREE.Vector3, layer: Layer): number {
    const octree = this.layerOctrees.get(layer.id);
    if (!octree) return 0;

    return octree.get(
      Math.floor(position.x),
      Math.floor(position.y),
      Math.floor(position.z)
    );
  }

  public getMesh(): THREE.Mesh | null {
    return this.meshes.main.mesh;
  }

  public applyOptimisticRect(
    layer: Layer,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    _rotation?: number
  ): void {
    void _rotation;
    if (layer.locked) return;
    const octree = this.layerOctrees.get(layer.id);
    if (!octree) return;

    const minX = Math.max(0, Math.floor(Math.min(start.x, end.x)));
    const maxX = Math.min(
      this.dimensions.x - 1,
      Math.floor(Math.max(start.x, end.x))
    );
    const minY = Math.max(0, Math.floor(Math.min(start.y, end.y)));
    const maxY = Math.min(
      this.dimensions.y - 1,
      Math.floor(Math.max(start.y, end.y))
    );
    const minZ = Math.max(0, Math.floor(Math.min(start.z, end.z)));
    const maxZ = Math.min(
      this.dimensions.z - 1,
      Math.floor(Math.max(start.z, end.z))
    );

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const current = octree.get(x, y, z);
          switch (mode.tag) {
            case "Attach":
              octree.set(x, y, z, blockType);
              break;
            case "Erase":
              octree.set(x, y, z, 0);
              break;
            case "Paint":
              if (current !== 0) {
                octree.set(x, y, z, blockType);
              }
              break;
          }
        }
      }
    }

    this.rebuildRenderOctree();
    this.updateMeshes();
  }

  public dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;

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
  }
}
