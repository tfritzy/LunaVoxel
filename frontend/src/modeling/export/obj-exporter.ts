import { ConsolidatedMesh } from "./mesh-consolidator";

export class OBJExporter {
    private mesh: ConsolidatedMesh;
    private projectName: string;

    constructor(mesh: ConsolidatedMesh, projectName: string) {
        this.mesh = mesh;
        this.projectName = projectName;
    }

    public generateOBJ(): string {
        const lines: string[] = [];

        lines.push(`# Exported from Lunavoxel`);
        lines.push(`# Project: ${this.projectName}`);
        lines.push(`# Generated: ${new Date().toISOString()}`);
        lines.push('');
        lines.push(`mtllib ${this.projectName}.mtl`);
        lines.push(`usemtl ${this.projectName}_material`);
        lines.push('');

        for (let i = 0; i < this.mesh.vertices.length; i += 3) {
            const x = this.mesh.vertices[i];
            const y = this.mesh.vertices[i + 1];
            const z = this.mesh.vertices[i + 2];
            lines.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
        }

        lines.push('');

        for (let i = 0; i < this.mesh.uvs.length; i += 2) {
            const u = this.mesh.uvs[i];
            const v = this.mesh.uvs[i + 1];
            lines.push(`vt ${u.toFixed(6)} ${v.toFixed(6)}`);
        }

        lines.push('');

        for (let i = 0; i < this.mesh.normals.length; i += 3) {
            const nx = this.mesh.normals[i];
            const ny = this.mesh.normals[i + 1];
            const nz = this.mesh.normals[i + 2];
            lines.push(`vn ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`);
        }

        lines.push('');

        for (let i = 0; i < this.mesh.indices.length; i += 3) {
            const i1 = this.mesh.indices[i] + 1;
            const i2 = this.mesh.indices[i + 1] + 1;
            const i3 = this.mesh.indices[i + 2] + 1;

            lines.push(`f ${i1}/${i1}/${i1} ${i2}/${i2}/${i2} ${i3}/${i3}/${i3}`);
        }

        return lines.join('\n');
    }

    public generateMTL(): string {
        const lines: string[] = [];

        lines.push(`# Material file for ${this.projectName}`);
        lines.push(`# Exported from Lunavoxel`);
        lines.push(`# Generated: ${new Date().toISOString()}`);
        lines.push('');
        lines.push(`newmtl ${this.projectName}_material`);
        lines.push('Ka 1.000000 1.000000 1.000000');
        lines.push('Kd 1.000000 1.000000 1.000000');
        lines.push('Ks 0.000000 0.000000 0.000000');
        lines.push('Ns 0.000000');
        lines.push('illum 1');
        lines.push(`map_Kd ${this.projectName}_texture.png`);

        return lines.join('\n');
    }
}