import * as THREE from "three";
import {
  ToolType,
  Vector3,
  DbConnection,
  EventContext,
  Layer,
  Selection,
} from "@/module_bindings";
import {
  getBlockType,
  isBlockPresent,
  decompressVoxelData,
  decompressVoxelDataInto,
} from "./voxel-data-utils";
import { AtlasData } from "@/lib/useAtlas";
import { calculateRectBounds } from "@/lib/rect-utils";
import { ExteriorFacesFinder } from "./find-exterior-faces";
import { createVoxelMaterial } from "./shader";
import { MeshArrays } from "./mesh-arrays";
import { layers } from "./layers";
import { VoxelFrame } from "./voxel-frame";

export const CHUNK_SIZE = 16;

type MeshType = "main" | "preview" | "selection";

interface MeshData {
  mesh: THREE.Mesh | null;
  meshArrays: MeshArrays;
}

export type DecompressedLayer = Omit<Layer, "voxels"> & { voxels: Uint8Array };
export type DecompressedSelection = Omit<Selection, "selectionData"> & {
  selectionData: Uint8Array;
};

export class Chunk {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private renderedBlocks: Uint8Array;
  private blocksToRender: Uint8Array;
  private currentUpdateId: number = 0;
  private dbConn: DbConnection;
  private projectId: string;
  private layers: DecompressedLayer[] = [];
  private selections: DecompressedSelection[] = [];

  // Mesh-related properties
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private meshes: Record<MeshType, MeshData>;
  private voxelData: Uint8Array[][];
  private facesFinder: ExteriorFacesFinder;
  private selectionFrame: VoxelFrame;
  private previewFrame: VoxelFrame;

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    dbConn: DbConnection,
    projectId: string
  ) {
    this.scene = scene;
    this.dimensions = dimensions;
    this.dbConn = dbConn;
    this.projectId = projectId;

    this.renderedBlocks = new Uint8Array(
      dimensions.x * dimensions.y * dimensions.z
    );
    this.blocksToRender = new Uint8Array(
      dimensions.x * dimensions.y * dimensions.z
    );

    this.selectionFrame = new VoxelFrame(dimensions);
    this.previewFrame = new VoxelFrame(dimensions);

    const maxFaces = dimensions.x * dimensions.y * dimensions.z * 6;
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
      selection: {
        mesh: null,
        meshArrays: new MeshArrays(maxVertices, maxIndices),
      },
    };

    this.voxelData = [];
    for (let x = 0; x < dimensions.x; x++) {
      this.voxelData[x] = [];
      for (let y = 0; y < dimensions.y; y++) {
        this.voxelData[x][y] = new Uint8Array(dimensions.z);
      }
    }

    const maxDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
    this.facesFinder = new ExteriorFacesFinder(maxDimension);

    this.dbConn.db.selections.onInsert(this.onSelectionInsert);
    this.dbConn.db.selections.onUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.onDelete(this.onSelectionDelete);

    this.dbConn.db.layer.onInsert(this.onLayerInsert);
    this.dbConn.db.layer.onUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.onDelete(this.onLayerDelete);

    this.refreshLayers();
    this.refreshSelections();
  }

  private copyChunkData(blocks: Uint8Array): void {
    for (let x = 0; x < this.dimensions.x; x++) {
      for (let y = 0; y < this.dimensions.y; y++) {
        for (let z = 0; z < this.dimensions.z; z++) {
          const blockIndex =
            x * this.dimensions.y * this.dimensions.z +
            y * this.dimensions.z +
            z;
          this.voxelData[x][y][z] = blocks[blockIndex];
        }
      }
    }
  }

  setTextureAtlas = (atlasData: AtlasData, buildMode: ToolType) => {
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

    this.copyChunkData(this.renderedBlocks);
    this.updateMeshes(buildMode, atlasData);
  };

  public getChunkDimensions(): Vector3 {
    return { x: 1, y: 1, z: 1 };
  }

  public getMesh(): THREE.Mesh | null {
    return this.meshes.main.mesh;
  }

  private clearBlocks(blocks: Uint8Array) {
    blocks.fill(0);
  }

  private addLayerToBlocks(
    layer: DecompressedLayer,
    blocks: Uint8Array
  ): void {
    const { x: xDim, y: yDim, z: zDim } = this.dimensions;

    if (layer.xDim !== xDim || layer.yDim !== yDim || layer.zDim !== zDim) {
      console.warn("Layer dimensions don't match world dimensions");
      return;
    }

    for (let i = 0; i < blocks.length; i++) {
      if (isBlockPresent(layer.voxels[i])) {
        blocks[i] = layer.voxels[i];
      }
    }
  }

  private updatePreviewState(
    previewFrame: VoxelFrame,
    blocks: Uint8Array,
    buildMode: ToolType
  ): void {
    if (previewFrame.isEmpty()) return;

    const isPaintMode = buildMode.tag === ToolType.Paint.tag;
    const isBuildMode = buildMode.tag === ToolType.Build.tag;
    const isEraseMode = buildMode.tag === ToolType.Erase.tag;

    // Iterate through all voxels and apply the appropriate preview logic
    for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
      const x = Math.floor(voxelIndex / (this.dimensions.y * this.dimensions.z));
      const y = Math.floor((voxelIndex % (this.dimensions.y * this.dimensions.z)) / this.dimensions.z);
      const z = voxelIndex % this.dimensions.z;
      
      const previewBlockValue = previewFrame.get(x, y, z);
      const hasPreview = previewBlockValue !== 0;
      const realBlockValue = blocks[voxelIndex];
      const hasRealBlock = isBlockPresent(realBlockValue);

      if (isBuildMode) {
        // Build mode: Show preview blocks where they'll be placed
        // - If preview exists and there's NO real block: show the preview block
        // - If preview exists and there IS a real block: hide preview (can't place here)
        if (hasPreview) {
          if (hasRealBlock) {
            // Can't build here, clear the preview for this voxel
            previewFrame.set(x, y, z, 0);
          }
          // else: keep preview as-is to show where block will be placed
        }
      } else if (isEraseMode) {
        // Erase mode: Show existing blocks as ghosted where they'll be erased
        // - If preview is active and there's a real block: the real block gets ghosted
        // - If preview is active but no real block: clear preview (nothing to erase)
        if (hasPreview) {
          if (!hasRealBlock) {
            // Nothing to erase here
            previewFrame.set(x, y, z, 0);
          } else {
            // Show the real block as ghosted - set preview to the real block value
            previewFrame.set(x, y, z, realBlockValue);
          }
        }
      } else if (isPaintMode) {
        // Paint mode: Show new block type where existing blocks will be repainted
        // - If preview is active and there's a real block: show the new block as preview
        // - If preview is active but no real block: clear preview (nothing to paint)
        if (hasPreview) {
          if (!hasRealBlock) {
            // Nothing to paint here
            previewFrame.set(x, y, z, 0);
          }
          // else: keep preview as-is (it contains the new block type)
        }
      }
    }
  }

  private updateSelectionState(
    selections: DecompressedSelection[],
    blocks: Uint8Array
  ): void {
    this.selectionFrame.clear();

    for (let i = 0; i < selections.length; i++) {
      for (let voxelIndex = 0; voxelIndex < blocks.length; voxelIndex++) {
        if (selections[i].selectionData[voxelIndex] != 0) {
          const newVoxelPos = selections[i].selectionData[voxelIndex] - 1; // -1 bc 1 indexed
          
          const blockValue = blocks[voxelIndex];
          
          const x = Math.floor(newVoxelPos / (this.dimensions.y * this.dimensions.z));
          const y = Math.floor((newVoxelPos % (this.dimensions.y * this.dimensions.z)) / this.dimensions.z);
          const z = newVoxelPos % this.dimensions.z;
          
          this.selectionFrame.set(x, y, z, blockValue || 1); // Use 1 if block is 0, so selection is visible

          if (newVoxelPos != voxelIndex) {
            blocks[voxelIndex] = 0;
          }
        }
      }
    }
  }

  public applyOptimisticRect(
    layer: DecompressedLayer,
    tool: ToolType,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    rotation: number
  ) {
    if (layer.locked) return;

    const layerDims = { x: layer.xDim, y: layer.yDim, z: layer.zDim };
    const bounds = calculateRectBounds(start, end, layerDims);

    const yDim = layer.yDim;
    const zDim = layer.zDim;

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const base = x * yDim * zDim + y * zDim;
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          const idx = base + z;
          const currentType = getBlockType(layer.voxels[idx]);

          switch (tool.tag) {
            case ToolType.Build.tag:
              layer.voxels[idx] = blockType;
              break;
            case ToolType.Erase.tag:
              layer.voxels[idx] = 0;
              break;
            case ToolType.Paint.tag:
              if (currentType !== 0) {
                layer.voxels[idx] = blockType;
              }
              break;
            default:
              break;
          }
        }
      }
    }
  }

  private decompressLayer = (
    layer: Layer,
    existingBuffer?: Uint8Array
  ): DecompressedLayer => {
    const buffer = existingBuffer || new Uint8Array(0);
    return {
      ...layer,
      voxels: decompressVoxelDataInto(layer.voxels, buffer),
    };
  };

  private decompressSelection = (
    selection: Selection,
    existingBuffer?: Uint8Array
  ): DecompressedSelection => {
    const buffer = existingBuffer || new Uint8Array(0);
    return {
      ...selection,
      selectionData: decompressVoxelDataInto(selection.selectionData, buffer),
    };
  };

  private refreshLayers = () => {
    const rawLayers = (this.dbConn.db.layer.tableCache.iter() as Layer[])
      .filter((l) => l.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    this.layers = rawLayers.map(this.decompressLayer);
  };

  private refreshSelections = () => {
    const rawSelections = (
      this.dbConn.db.selections.tableCache.iter() as Selection[]
    ).filter((s) => s.projectId === this.projectId);

    this.selections = rawSelections.map(this.decompressSelection);
  };

  private onSelectionInsert = (ctx: EventContext, newSelection: Selection) => {
    if (newSelection.projectId !== this.projectId) return;
    if (this.selections.some((s) => s.id === newSelection.id)) return;

    const decompressedSelection = this.decompressSelection(newSelection);
    this.selections = [...this.selections, decompressedSelection];
  };

  private onSelectionUpdate = (
    ctx: EventContext,
    oldSelection: Selection,
    newSelection: Selection
  ) => {
    if (newSelection.projectId !== this.projectId) return;

    // Find the existing selection to reuse its buffer
    const existingSelection = this.selections.find((s) => s.id === newSelection.id);
    const decompressedSelection = this.decompressSelection(
      newSelection,
      existingSelection?.selectionData
    );
    this.selections = this.selections.map((s) =>
      s.id === newSelection.id ? decompressedSelection : s
    );
  };

  private onSelectionDelete = (
    ctx: EventContext,
    deletedSelection: Selection
  ) => {
    if (deletedSelection.projectId !== this.projectId) return;
    this.selections = this.selections.filter(
      (s) => s.id !== deletedSelection.id
    );
  };

  private onLayerInsert = (ctx: EventContext, newLayer: Layer) => {
    if (newLayer.projectId !== this.projectId) return;
    if (this.layers.some((l) => l.id === newLayer.id)) return;

    const decompressedLayer = this.decompressLayer(newLayer);
    this.layers = [...this.layers, decompressedLayer].sort(
      (a, b) => a.index - b.index
    );
  };

  private onLayerUpdate = (
    ctx: EventContext,
    oldLayer: Layer,
    newLayer: Layer
  ) => {
    if (newLayer.projectId !== this.projectId) return;

    // Find the existing layer to reuse its buffer
    const existingLayer = this.layers.find((l) => l.id === newLayer.id);
    const decompressedLayer = this.decompressLayer(newLayer, existingLayer?.voxels);
    this.layers = this.layers
      .map((l) => (l.id === newLayer.id ? decompressedLayer : l))
      .sort((a, b) => a.index - b.index);
  };

  private onLayerDelete = (ctx: EventContext, deletedLayer: Layer) => {
    if (deletedLayer.projectId !== this.projectId) return;
    this.layers = this.layers.filter((l) => l.id !== deletedLayer.id);
  };

  public getLayer(layerIndex: number): DecompressedLayer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
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
    geometry.setIndex(
      new THREE.BufferAttribute(meshArrays.getIndices(), 1)
    );

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
    geometry.attributes.aochannel.needsUpdate = true;
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

  private updateMainMesh = (atlasData: AtlasData): void => {
    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = createVoxelMaterial(atlasData.texture);
      this.meshes.main.mesh = new THREE.Mesh(this.geometry, this.material);
      this.meshes.main.mesh.castShadow = true;
      this.meshes.main.mesh.receiveShadow = true;

      this.meshes.main.mesh.position.set(0, 0, 0);

      this.scene.add(this.meshes.main.mesh);
    }

    this.updateMeshGeometry("main", this.meshes.main.meshArrays);
  };

  private updatePreviewMesh = (
    buildMode: ToolType,
    atlasData: AtlasData
  ): void => {
    if (!this.meshes.preview.mesh) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(atlasData.texture, 1);
      this.meshes.preview.mesh = new THREE.Mesh(geometry, material);

      this.meshes.preview.mesh.position.set(0, 0, 0);

      this.scene.add(this.meshes.preview.mesh);
    }

    this.updateMeshGeometry("preview", this.meshes.preview.meshArrays);

    this.meshes.preview.mesh.visible =
      buildMode.tag === ToolType.Build.tag ||
      buildMode.tag === ToolType.Paint.tag;
    this.meshes.preview.mesh.layers.set(
      buildMode.tag === ToolType.Build.tag ? layers.ghost : layers.raycast
    );
  };

  private updateSelectionMesh = (atlasData: AtlasData): void => {
    if (!this.meshes.selection.mesh) {
      const geometry = new THREE.BufferGeometry();
      const material = createVoxelMaterial(atlasData.texture, 1, true);
      this.meshes.selection.mesh = new THREE.Mesh(geometry, material);

      this.meshes.selection.mesh.position.set(0, 0, 0);

      this.scene.add(this.meshes.selection.mesh);
    }

    this.updateMeshGeometry("selection", this.meshes.selection.meshArrays);

    this.meshes.selection.mesh.visible = this.meshes.selection.meshArrays.vertexCount > 0;
    console.log(this.meshes.selection.mesh.visible, "visible?");
  };

  private updateMeshes = (buildMode: ToolType, atlasData: AtlasData) => {
    const previewOccludes = buildMode.tag !== ToolType.Erase.tag;
    
    this.facesFinder.findExteriorFaces(
      this.voxelData,
      atlasData.texture?.image.width,
      atlasData.blockAtlasMappings,
      this.dimensions,
      this.meshes.main.meshArrays,
      this.meshes.preview.meshArrays,
      this.meshes.selection.meshArrays,
      this.previewFrame,
      this.selectionFrame,
      previewOccludes
    );

    this.updateMainMesh(atlasData);
    this.updatePreviewMesh(buildMode, atlasData);
    this.updateSelectionMesh(atlasData);
  };

  update = (
    previewFrame: VoxelFrame,
    buildMode: ToolType,
    atlasData: AtlasData
  ) => {
    try {
      this.previewFrame = previewFrame;

      const visibleLayers = this.layers
        .filter((layer) => layer.visible)
        .sort((l1, l2) => l2.index - l1.index);

      const visibleSelections = this.selections.filter(
        (s) => this.layers[s.layer]?.visible
      );

      if (visibleLayers.length === 0) {
        this.clearBlocks(this.blocksToRender);
      } else {
        const firstLayer = visibleLayers[visibleLayers.length - 1];
        this.blocksToRender.set(firstLayer.voxels);

        for (let i = visibleLayers.length - 2; i >= 0; i--) {
          this.addLayerToBlocks(visibleLayers[i], this.blocksToRender);
        }
      }

      this.updatePreviewState(previewFrame, this.blocksToRender, buildMode);
      this.updateSelectionState(visibleSelections, this.blocksToRender);

      // Check if any blocks changed
      let hasChanges = false;
      for (let i = 0; i < this.blocksToRender.length; i++) {
        if (this.blocksToRender[i] !== this.renderedBlocks[i]) {
          hasChanges = true;
          break;
        }
      }

      // Always update if preview or selection is active
      if (!hasChanges && (!this.previewFrame.isEmpty() || !this.selectionFrame.isEmpty())) {
        hasChanges = true;
      }

      // Update the single chunk mesh if there are changes
      if (hasChanges) {
        this.copyChunkData(this.blocksToRender);
        this.updateMeshes(buildMode, atlasData);
      }

      this.renderedBlocks.set(this.blocksToRender);
    } catch (error) {
      console.error(`[ChunkManager] Update failed:`, error);
      throw error;
    }
  };

  dispose = () => {
    this.currentUpdateId++;

    // Unsubscribe from database events
    this.dbConn.db.selections.removeOnInsert(this.onSelectionInsert);
    this.dbConn.db.selections.removeOnUpdate(this.onSelectionUpdate);
    this.dbConn.db.selections.removeOnDelete(this.onSelectionDelete);
    this.dbConn.db.layer.removeOnInsert(this.onLayerInsert);
    this.dbConn.db.layer.removeOnUpdate(this.onLayerUpdate);
    this.dbConn.db.layer.removeOnDelete(this.onLayerDelete);

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
