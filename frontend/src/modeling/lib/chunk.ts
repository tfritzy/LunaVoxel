import { DbConnection, EventContext, Layer } from "@/module_bindings";
import { RenderPipeline } from "@/wasm/vector3_wasm";
import { isWasmInitialized } from "@/lib/wasmInit";

export class Chunk {
  private renderPipeline: RenderPipeline;
  private dbConn: DbConnection;

  public constructor(dbConn: DbConnection) {
    if (!isWasmInitialized()) {
      throw new Error(
        "WASM module not initialized. Please ensure initWasm() is called before creating a Chunk."
      );
    }

    this.dbConn = dbConn;
    this.renderPipeline = new RenderPipeline();

    dbConn.db.layer.onInsert(this.onLayerInsert);
    dbConn.db.layer.onUpdate(this.onLayerInsert);
  }

  private onLayerInsert = (ctx: EventContext, newLayer: Layer) => {
    console.log("compressed chunk data", newLayer.voxels);
    this.renderPipeline.addLayer(newLayer.voxels);
    console.log(
      "Decompressed chunk data",
      this.renderPipeline.getLayerVoxels(0)
    );
  };
}
