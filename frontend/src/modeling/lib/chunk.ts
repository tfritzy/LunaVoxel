import { DbConnection, EventContext, Layer, ToolType, Vector3 } from "@/module_bindings";
import { MeshData, RenderPipeline } from "@/wasm/vector3_wasm";
import { isWasmInitialized } from "@/lib/wasmInit";
import { AtlasData } from "@/lib/useAtlas";
import * as THREE from "three";
import { createVoxelMaterial } from "./shader";
import { layers } from "./layers";

export const CHUNK_SIZE = 16;

type MeshType = "real" | "preview" | "selection";

interface MeshConfig {
  opacity: number;
  showGrid: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
}

export class Chunk {
  private renderPipeline: RenderPipeline;
  private dbConn: DbConnection;
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private chunkPosition: Vector3;
  private meshes: Map<MeshType, THREE.Mesh> = new Map();
  private currentAtlasData: AtlasData | null = null;
  private currentBuildMode: ToolType = ToolType.Build;

  public constructor(
    dbConn: DbConnection,
    scene: THREE.Scene,
    dimensions: Vector3,
    chunkPosition: Vector3 = { x: 0, y: 0, z: 0 }
  ) {
    if (!isWasmInitialized()) {
      throw new Error(
        "WASM module not initialized. Please ensure initWasm() is called before creating a Chunk."
      );
    }

    this.dbConn = dbConn;
    this.scene = scene;
    this.dimensions = dimensions;
    this.chunkPosition = chunkPosition;
    this.renderPipeline = new RenderPipeline(dimensions.x, dimensions.y, dimensions.z);

    dbConn.db.layer.onInsert(this.onLayerInsert);
    dbConn.db.layer.onUpdate(this.onLayerUpdate);
  }

  private onLayerInsert = (ctx: EventContext, newLayer: Layer) => {
    this.renderPipeline.addLayer(newLayer.index, newLayer.voxels, newLayer.visible);
    if (this.currentAtlasData) {
      this.render();
    }
  };

  private onLayerUpdate = (ctx: EventContext, oldLayer: Layer, newLayer: Layer) => {
    this.renderPipeline.updateLayer(newLayer.index, newLayer.voxels, newLayer.visible);
    if (this.currentAtlasData) {
      this.render();
    }
  };

  private render = () => {
    if (!this.currentAtlasData) return;

    const startTime = performance.now();
    
    const meshResult = this.renderPipeline.render(
      this.currentBuildMode.tag === ToolType.Erase.tag,
      true
    );
    
    if (meshResult) {
      const realMesh = meshResult.realMesh;
      const previewMesh = meshResult.previewMesh;
      const selectionMesh = meshResult.selectionMesh;
      
      this.updateMeshFromData("real", realMesh, {
        opacity: 1,
        showGrid: false,
        castShadow: true,
        receiveShadow: true,
      });
      
      this.updateMeshFromData("preview", previewMesh, {
        opacity: 1,
        showGrid: false,
        castShadow: false,
        receiveShadow: false,
      });
      
      this.updateMeshFromData("selection", selectionMesh, {
        opacity: 1,
        showGrid: true,
        castShadow: false,
        receiveShadow: false,
      });
      
      this.updateMeshVisibility();
    }

    const endTime = performance.now();
    const renderTime = endTime - startTime;
    const totalVoxels = this.dimensions.x * this.dimensions.y * this.dimensions.z;
    const voxelsPerMs = totalVoxels / renderTime;
    console.log(`Render took ${renderTime.toFixed(2)}ms (${voxelsPerMs.toFixed(0)} voxels/ms, ${totalVoxels} total voxels)`);
  };

  private updateMeshGeometry = (
    mesh: THREE.Mesh,
    vertices: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    ao: Float32Array,
    indices: Uint32Array
  ): void => {
    mesh.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );
    mesh.geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(normals, 3)
    );
    mesh.geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(uvs, 2)
    );
    mesh.geometry.setAttribute(
      "aochannel",
      new THREE.BufferAttribute(ao, 1)
    );
    mesh.geometry.setIndex(
      new THREE.BufferAttribute(indices, 1)
    );

    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.attributes.normal.needsUpdate = true;
    mesh.geometry.attributes.uv.needsUpdate = true;
    mesh.geometry.attributes.aochannel.needsUpdate = true;
    if (mesh.geometry.index) {
      mesh.geometry.index.needsUpdate = true;
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
    mesh.geometry.boundingSphere = new THREE.Sphere(center, radius);
  };

  private updateMeshFromData = (
    type: MeshType,
    meshData: MeshData,
    config: MeshConfig
  ): void => {
    if (!this.currentAtlasData) return;

    if (!this.meshes.has(type)) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(
        this.currentAtlasData.texture,
        config.opacity,
        config.showGrid
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = config.castShadow;
      mesh.receiveShadow = config.receiveShadow;

      mesh.position.set(
        this.chunkPosition.x * CHUNK_SIZE,
        this.chunkPosition.y * CHUNK_SIZE,
        this.chunkPosition.z * CHUNK_SIZE
      );

      this.scene.add(mesh);
      this.meshes.set(type, mesh);
    }

    const mesh = this.meshes.get(type)!;
    
    // Convert JS arrays from WASM to TypedArrays
    const vertices = new Float32Array(meshData.vertices);
    const normals = new Float32Array(meshData.normals);
    const uvs = new Float32Array(meshData.uvs);
    const ao = new Float32Array(meshData.ao);
    const indices = new Uint32Array(meshData.indices);
    
    this.updateMeshGeometry(
      mesh,
      vertices,
      normals,
      uvs,
      ao,
      indices
    );
  };

  private updateMeshVisibility = (): void => {
    const previewMesh = this.meshes.get("preview");
    if (previewMesh) {
      const hasVertices = previewMesh.geometry.attributes.position?.count > 0;
      previewMesh.visible =
        hasVertices &&
        (this.currentBuildMode.tag === ToolType.Build.tag ||
          this.currentBuildMode.tag === ToolType.Paint.tag);
      previewMesh.layers.set(
        this.currentBuildMode.tag === ToolType.Build.tag ? layers.ghost : layers.raycast
      );
    }

    const selectionMesh = this.meshes.get("selection");
    if (selectionMesh) {
      const hasVertices = selectionMesh.geometry.attributes.position?.count > 0;
      selectionMesh.visible = hasVertices;
    }
  };

  setBuildMode = (buildMode: ToolType) => {
    this.currentBuildMode = buildMode;
    if (this.currentAtlasData) {
      this.render();
    }
  };

  setTextureAtlas = (atlasData: AtlasData) => {
    this.currentAtlasData = atlasData;
    
    const flatMappings = new Uint32Array(atlasData.blockAtlasMappings.flat());
    this.renderPipeline.updateAtlasData(flatMappings, atlasData.texture?.image.width ?? 1);
    
    this.meshes.forEach((mesh) => {
      const material = mesh.material as THREE.ShaderMaterial;
      material.uniforms.map.value = atlasData.texture;
      material.needsUpdate = true;
    });

    this.render();
  };

  dispose = () => {
    this.meshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.meshes.clear();
  };
}
