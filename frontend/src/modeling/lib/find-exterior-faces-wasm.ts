import type { Vector3 } from "@/state/types";
import type { MeshArrays } from "./mesh-arrays";
import init, {
  WasmExteriorFacesFinder,
} from "@/wasm/lunavoxel_wasm";

let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

async function ensureWasmInitialized(): Promise<void> {
  if (wasmInitialized) return;
  if (wasmInitPromise) return wasmInitPromise;
  wasmInitPromise = init()
    .then(() => {
      wasmInitialized = true;
    })
    .catch(() => {
      wasmInitPromise = null;
    });
  return wasmInitPromise;
}

export function isWasmReady(): boolean {
  return wasmInitialized;
}

export async function initWasm(): Promise<void> {
  await ensureWasmInitialized();
}

export class WasmExteriorFacesFinderWrapper {
  private finder: WasmExteriorFacesFinder | null = null;
  private maxDimension: number;
  private int32AtlasMapping: Int32Array | null = null;

  constructor(maxDimension: number) {
    this.maxDimension = maxDimension;
    if (wasmInitialized) {
      this.finder = new WasmExteriorFacesFinder(maxDimension);
    }
  }

  private ensureFinder(): WasmExteriorFacesFinder {
    if (!this.finder) {
      this.finder = new WasmExteriorFacesFinder(this.maxDimension);
    }
    return this.finder;
  }

  public findExteriorFaces(
    voxelData: Uint8Array,
    textureWidth: number,
    blockAtlasMapping: number[],
    dimensions: Vector3,
    meshArrays: MeshArrays,
    selectionBuffer: Uint8Array,
    selectionWorldDims: Vector3,
    chunkOffset: Vector3,
    selectionEmpty: boolean
  ): void {
    const finder = this.ensureFinder();

    if (
      !this.int32AtlasMapping ||
      this.int32AtlasMapping.length !== blockAtlasMapping.length
    ) {
      this.int32AtlasMapping = new Int32Array(blockAtlasMapping.length);
    }
    for (let i = 0; i < blockAtlasMapping.length; i++) {
      this.int32AtlasMapping[i] = blockAtlasMapping[i];
    }

    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    const maxFaces = totalVoxels * 6;

    finder.findExteriorFaces(
      voxelData,
      textureWidth,
      this.int32AtlasMapping,
      dimensions.x,
      dimensions.y,
      dimensions.z,
      maxFaces * 4,
      maxFaces * 6,
      selectionEmpty ? new Uint8Array(0) : selectionBuffer,
      selectionWorldDims.y,
      selectionWorldDims.z,
      chunkOffset.x,
      chunkOffset.y,
      chunkOffset.z,
      selectionEmpty
    );

    meshArrays.reset();

    const vertexCount = finder.getVertexCount();
    const indexCount = finder.getIndexCount();

    if (vertexCount > 0) {
      const vertices = finder.getVertices();
      const normals = finder.getNormals();
      const uvs = finder.getUVs();
      const ao = finder.getAO();
      const isSelected = finder.getIsSelected();
      const indices = finder.getIndices();

      meshArrays.vertices.set(vertices);
      meshArrays.normals.set(normals);
      meshArrays.uvs.set(uvs);
      meshArrays.ao.set(ao);
      meshArrays.isSelected.set(isSelected);
      meshArrays.indices.set(indices);
    }

    meshArrays.vertexCount = vertexCount;
    meshArrays.indexCount = indexCount;
  }
}
