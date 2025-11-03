export class MeshArrays {
    vertices: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    ao: Float32Array;
    isSelected: Float32Array;
    indices: Uint32Array;
    vertexCount: number = 0;
    indexCount: number = 0;

    constructor(maxVertices: number, maxIndices: number) {
        this.vertices = new Float32Array(maxVertices * 3);
        this.normals = new Float32Array(maxVertices * 3);
        this.uvs = new Float32Array(maxVertices * 2);
        this.ao = new Float32Array(maxVertices);
        this.isSelected = new Float32Array(maxVertices);
        this.indices = new Uint32Array(maxIndices);
    }

    reset() {
        this.vertexCount = 0;
        this.indexCount = 0;
    }

    pushVertex(x: number, y: number, z: number): void {
        const offset = this.vertexCount * 3;
        this.vertices[offset] = x;
        this.vertices[offset + 1] = y;
        this.vertices[offset + 2] = z;
    }

    pushNormal(x: number, y: number, z: number): void {
        const offset = this.vertexCount * 3;
        this.normals[offset] = x;
        this.normals[offset + 1] = y;
        this.normals[offset + 2] = z;
    }

    pushUV(u: number, v: number): void {
        const offset = this.vertexCount * 2;
        this.uvs[offset] = u;
        this.uvs[offset + 1] = v;
    }

    pushAO(value: number): void {
        this.ao[this.vertexCount] = value;
    }

    pushIsSelected(value: number): void {
        this.isSelected[this.vertexCount] = value;
    }

    incrementVertex(): number {
        return this.vertexCount++;
    }

    pushIndex(index: number): void {
        this.indices[this.indexCount++] = index;
    }

    getVertices() {
        return this.vertices.subarray(0, this.vertexCount * 3);
    }

    getNormals() {
        return this.normals.subarray(0, this.vertexCount * 3);
    }

    getUVs() {
        return this.uvs.subarray(0, this.vertexCount * 2);
    }

    getAO() {
        return this.ao.subarray(0, this.vertexCount);
    }

    getIsSelected() {
        return this.isSelected.subarray(0, this.vertexCount);
    }

    getIndices() {
        return this.indices.subarray(0, this.indexCount);
    }
}