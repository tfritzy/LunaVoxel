import { OctreeManager } from "../lib/octree-manager";
import type { Project } from "@/state/types";
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
  private octreeManager: OctreeManager;
  private project: Project;
  private atlasData: AtlasData | null;

  constructor(
    octreeManager: OctreeManager,
    project: Project,
    atlasData: AtlasData | null
  ) {
    this.octreeManager = octreeManager;
    this.project = project;
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

      if (this.atlasData?.texture) {
        try {
          const canvas = extractTextureAtlasImage(this.atlasData.texture);
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

  private exportSTL(): void {
    try {
      const consolidatedMesh = this.getConsolidatedMesh();
      if (!consolidatedMesh) return;

      const projectName = this.sanitizeFilename(this.project.name);
      const exporter = new STLExporter(consolidatedMesh, projectName);

      const stlContent = exporter.generateSTL();

      downloadFile(stlContent, `${projectName}.stl`, "text/plain");

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
      this.octreeManager,
      worldDimensions
    );
    const consolidatedMesh = consolidator.consolidateMesh();

    if (consolidatedMesh.vertices.length === 0) {
      toast.success(
        "No geometry to export. Please add some blocks to your project first."
      );
      return null;
    }

    return consolidatedMesh;
  }

  private exportTexture(projectName: string): void {
    if (this.atlasData?.texture) {
      try {
        const canvas = extractTextureAtlasImage(this.atlasData?.texture);
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
