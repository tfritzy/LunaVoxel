import * as THREE from "three";
import { ChunkManager } from "../lib/chunk-manager";
import { Atlas, ProjectBlocks, Project } from "../../module_bindings";
import { MeshConsolidator } from "./mesh-consolidator";
import { OBJExporter } from "./obj-exporter";
import {
  downloadFile,
  downloadImageFromCanvas,
  extractTextureAtlasImage,
} from "./file-utils";

export class BlenderExporter {
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

  public exportOBJ(): void {
    try {
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
        alert(
          "No geometry to export. Please add some blocks to your project first."
        );
        return;
      }

      const projectName = this.sanitizeFilename(this.project.name);
      const exporter = new OBJExporter(consolidatedMesh, projectName);

      const objContent = exporter.generateOBJ();
      const mtlContent = exporter.generateMTL();

      downloadFile(objContent, `${projectName}.obj`, "text/plain");
      downloadFile(mtlContent, `${projectName}.mtl`, "text/plain");

      if (this.textureAtlas) {
        try {
          const canvas = extractTextureAtlasImage(this.textureAtlas);
          downloadImageFromCanvas(canvas, `${projectName}_texture.png`);
        } catch (error) {
          console.error("Failed to export texture atlas:", error);
          alert(
            "3D model exported successfully, but texture export failed. You may need to manually apply textures in Blender."
          );
        }
      } else {
        alert(
          "3D model exported successfully! Note: No texture atlas was available, so you may need to manually apply textures in Blender."
        );
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please check the console for details.");
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
