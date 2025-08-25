import * as THREE from "three";
import { ChunkManager } from "../lib/chunk-manager";
import { Atlas, ProjectBlocks, Project } from "../../module_bindings";
import { MeshConsolidator } from "./mesh-consolidator";
import { OBJExporter } from "./obj-exporter";
import { GLTFExporter } from "./gltf-exporter";
import {
  downloadFile,
  downloadImageFromCanvas,
  extractTextureAtlasImage,
} from "./file-utils";
import { toast } from "sonner";

export type ExportType = "GLTF" | "OBJ";

export class ModelExporter {
  private chunkManager: ChunkManager;
  private atlas: Atlas | null;
  private blocks: ProjectBlocks | null;
  private project: Project;
  private textureAtlas: THREE.Texture | null;

  constructor(
    chunkManager: ChunkManager,
    atlas: Atlas | null,
    blocks: ProjectBlocks | null,
    project: Project,
    textureAtlas: THREE.Texture | null
  ) {
    this.chunkManager = chunkManager;
    this.atlas = atlas;
    this.blocks = blocks;
    this.project = project;
    this.textureAtlas = textureAtlas;
  }

  public export(type: ExportType): void {
    switch (type) {
      case "GLTF":
        this.exportGLTF();
        break;
      case "OBJ":
        this.exportOBJ();
        break;
      default:
        throw "Unknown export type " + type;
    }
  }

  private exportOBJ(): void {
    try {
      const consolidatedMesh = this.getConsolidatedMesh();
      if (!consolidatedMesh) return;

      const projectName = this.sanitizeFilename(this.project.name);
      const exporter = new OBJExporter(consolidatedMesh, projectName);

      const objContent = exporter.generateOBJ();
      const mtlContent = exporter.generateMTL();

      downloadFile(objContent, `${projectName}.obj`, "text/plain");
      downloadFile(mtlContent, `${projectName}.mtl`, "text/plain");

      this.exportTexture(projectName);
      toast.success("Export successful");
    } catch {
      toast.error("Sorry, export failed.");
    }
  }

  private exportGLTF(): void {
    try {
      const consolidatedMesh = this.getConsolidatedMesh();
      if (!consolidatedMesh) return;

      const projectName = this.sanitizeFilename(this.project.name);
      let textureDataUri: string | undefined;

      if (this.textureAtlas) {
        try {
          const canvas = extractTextureAtlasImage(this.textureAtlas);
          textureDataUri = canvas.toDataURL("image/png");
        } catch (error) {
          console.error("Failed to extract texture for GLTF:", error);
        }
      }

      const exporter = new GLTFExporter(consolidatedMesh, projectName);
      const gltfContent = exporter.generateGLTF(textureDataUri);

      downloadFile(gltfContent, `${projectName}.gltf`, "application/json");

      toast.success("Export successful");
    } catch {
      toast.error("Sorry, export failed.");
    }
  }

  private getConsolidatedMesh() {
    const worldDimensions = {
      x: this.project.dimensions.x,
      y: this.project.dimensions.y,
      z: this.project.dimensions.z,
    };

    const consolidator = new MeshConsolidator(
      this.chunkManager,
      worldDimensions
    );
    const consolidatedMesh = consolidator.consolidateAllChunks();

    if (consolidatedMesh.vertices.length === 0) {
      toast.success(
        "No geometry to export. Please add some blocks to your project first."
      );
      return null;
    }

    return consolidatedMesh;
  }

  private exportTexture(projectName: string): void {
    if (this.textureAtlas) {
      try {
        const canvas = extractTextureAtlasImage(this.textureAtlas);
        downloadImageFromCanvas(canvas, `${projectName}_texture.png`);
      } catch (error) {
        console.error("Failed to export texture atlas:", error);
      }
    }
  }

  private sanitizeFilename(filename: string): string {
    return (
      filename
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase() || "lunavoxel_export"
    );
  }
}
