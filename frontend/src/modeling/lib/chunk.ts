import { DbConnection, EventContext, Layer, Vector3 } from "@/module_bindings";
import { RenderPipeline } from "@/wasm/vector3_wasm";
import { isWasmInitialized } from "@/lib/wasmInit";
import { AtlasData } from "@/lib/useAtlas";

export class Chunk {
  private renderPipeline: RenderPipeline;
  private dbConn: DbConnection;

  public constructor(dbConn: DbConnection, dimensions: Vector3) {
    if (!isWasmInitialized()) {
      throw new Error(
        "WASM module not initialized. Please ensure initWasm() is called before creating a Chunk."
      );
    }

    this.dbConn = dbConn;
    this.renderPipeline = new RenderPipeline(dimensions.x, dimensions.y, dimensions.z);

    dbConn.db.layer.onInsert(this.onLayerInsert);
    dbConn.db.layer.onUpdate(this.onLayerUpdate);
  }

  private onLayerInsert = (ctx: EventContext, newLayer: Layer) => {
    this.renderPipeline.addLayer(newLayer.index, newLayer.voxels, newLayer.visible);
  };

  private onLayerUpdate = (ctx: EventContext, oldLayer: Layer, newLayer: Layer) => {
    this.renderPipeline.updateLayer(newLayer.index, newLayer.voxels, newLayer.visible);
    const startTime = performance.now();
    this.renderPipeline.render(false, false);
    const endTime = performance.now();
    console.log(`Render took ${(endTime - startTime).toFixed(2)}ms`);
  };

  setTextureAtlas = (atlasData: AtlasData) => {
    const flatMappings = new Uint32Array(atlasData.blockAtlasMappings.flat());
    this.renderPipeline.updateAtlasData(flatMappings, atlasData.texture?.image.width ?? 1);
  };
}
