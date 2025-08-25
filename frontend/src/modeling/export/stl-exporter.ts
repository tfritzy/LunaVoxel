import { ConsolidatedMesh } from "./mesh-consolidator";

export class STLExporter {
  private mesh: ConsolidatedMesh;
  private projectName: string;

  constructor(mesh: ConsolidatedMesh, projectName: string) {
    this.mesh = mesh;
    this.projectName = projectName;
  }

  public generateSTL(): string {
    const lines: string[] = [];

    lines.push(`solid ${this.projectName}`);

    for (let i = 0; i < this.mesh.indices.length; i += 3) {
      const i1 = this.mesh.indices[i];
      const i2 = this.mesh.indices[i + 1];
      const i3 = this.mesh.indices[i + 2];

      const v1x = this.mesh.vertices[i1 * 3];
      const v1y = this.mesh.vertices[i1 * 3 + 1];
      const v1z = this.mesh.vertices[i1 * 3 + 2];

      const v2x = this.mesh.vertices[i2 * 3];
      const v2y = this.mesh.vertices[i2 * 3 + 1];
      const v2z = this.mesh.vertices[i2 * 3 + 2];

      const v3x = this.mesh.vertices[i3 * 3];
      const v3y = this.mesh.vertices[i3 * 3 + 1];
      const v3z = this.mesh.vertices[i3 * 3 + 2];

      const nx = this.mesh.normals[i1 * 3];
      const ny = this.mesh.normals[i1 * 3 + 1];
      const nz = this.mesh.normals[i1 * 3 + 2];

      lines.push(
        `  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`
      );
      lines.push(`    outer loop`);
      lines.push(
        `      vertex ${v1x.toFixed(6)} ${v1y.toFixed(6)} ${v1z.toFixed(6)}`
      );
      lines.push(
        `      vertex ${v2x.toFixed(6)} ${v2y.toFixed(6)} ${v2z.toFixed(6)}`
      );
      lines.push(
        `      vertex ${v3x.toFixed(6)} ${v3y.toFixed(6)} ${v3z.toFixed(6)}`
      );
      lines.push(`    endloop`);
      lines.push(`  endfacet`);
    }

    lines.push(`endsolid ${this.projectName}`);

    return lines.join("\n");
  }
}
