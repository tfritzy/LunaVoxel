import { ChunkManager } from "../lib/chunk-manager";
import type { Vector3 } from "@/state";
import { MeshConsolidator } from "./mesh-consolidator";
import { OBJExporter } from "./obj-exporter";
import { GLTFExporter } from "./gltf-exporter";
import { STLExporter } from "./stl-exporter";
import {
  downloadFile,
  downloadImageFromCanvas,
  extractTextureAtlasImage,
} from "./file-utils";
import { toast } from "sonner";
import { AtlasData } from "@/lib/useAtlas";

export type ExportType = "GLTF" | "OBJ" | "STL";

export class ModelExporter {
  private chunkManager: ChunkManager;
  private dimensions: Vector3;
  private atlasData: AtlasData | null;

  constructor(
    chunkManager: ChunkManager,
    dimensions: Vector3,
    atlasData: AtlasData | null
  ) {
    this.chunkManager = chunkManager;
    this.dimensions = dimensions;
    this.atlasData = atlasData;
  }

  public export(type: ExportType): void {
    switch (type) {
      case "GLTF":
        this.exportGLTF();
        break;
      case "OBJ":
        this.exportOBJ();
        break;
      case "STL":
        this.exportSTL();
        break;
      default:
        throw "Unknown export type " + type;
    }
  }

  private exportOBJ(): void {
    try {
      const consolidatedMesh = this.getConsolidatedMesh();
      if (!consolidatedMesh) return;

      const filename = "lunavoxel_export";
      const exporter = new OBJExporter(consolidatedMesh, filename);

      const objContent = exporter.generateOBJ();
      const mtlContent = exporter.generateMTL();

      downloadFile(objContent, `${filename}.obj`, "text/plain");
      downloadFile(mtlContent, `${filename}.mtl`, "text/plain");

      this.exportTexture(filename);
      toast.success("Export successful");
    } catch {
      toast.error("Sorry, export failed.");
    }
  }

  private exportGLTF(): void {
    try {
      const consolidatedMesh = this.getConsolidatedMesh();
      if (!consolidatedMesh) return;

      const filename = "lunavoxel_export";
      let textureDataUri: string | undefined;

      if (this.atlasData?.texture) {
        try {
          const canvas = extractTextureAtlasImage(this.atlasData.texture);
          textureDataUri = canvas.toDataURL("image/png");
        } catch (error) {
          console.error("Failed to extract texture for GLTF:", error);
        }
      }

      const exporter = new GLTFExporter(consolidatedMesh, filename);
      const gltfContent = exporter.generateGLTF(textureDataUri);

      downloadFile(gltfContent, `${filename}.gltf`, "application/json");

      toast.success("Export successful");
    } catch {
      toast.error("Sorry, export failed.");
    }
  }

  private exportSTL(): void {
    try {
      const consolidatedMesh = this.getConsolidatedMesh();
      if (!consolidatedMesh) return;

      const filename = "lunavoxel_export";
      const exporter = new STLExporter(consolidatedMesh, filename);

      const stlContent = exporter.generateSTL();

      downloadFile(stlContent, `${filename}.stl`, "text/plain");

      toast.success("Export successful");
    } catch {
      toast.error("Sorry, export failed.");
    }
  }

  private getConsolidatedMesh() {
    const worldDimensions = {
      x: this.dimensions.x,
      y: this.dimensions.y,
      z: this.dimensions.z,
    };

    const consolidator = new MeshConsolidator(
      this.chunkManager,
      worldDimensions
    );
    const consolidatedMesh = consolidator.consolidateAllChunks();

    if (consolidatedMesh.vertices.length === 0) {
      toast.success(
        "No geometry to export. Please add some blocks first."
      );
      return null;
    }

    return consolidatedMesh;
  }

  private exportTexture(filename: string): void {
    if (this.atlasData?.texture) {
      try {
        const canvas = extractTextureAtlasImage(this.atlasData?.texture);
        downloadImageFromCanvas(canvas, `${filename}_texture.png`);
      } catch (error) {
        console.error("Failed to export texture atlas:", error);
      }
    }
  }
}
