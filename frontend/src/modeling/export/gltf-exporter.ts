import { ConsolidatedMesh } from "./mesh-consolidator";

export class GLTFExporter {
  private mesh: ConsolidatedMesh;
  private projectName: string;

  constructor(mesh: ConsolidatedMesh, projectName: string) {
    this.mesh = mesh;
    this.projectName = projectName;
  }

  public generateGLTF(textureDataUri?: string): string {
    const gltf = {
      asset: {
        version: "2.0",
        generator: "Lunavoxel",
      },
      scene: 0,
      scenes: [
        {
          name: this.projectName,
          nodes: [0],
        },
      ],
      nodes: [
        {
          name: `${this.projectName}_mesh`,
          mesh: 0,
        },
      ],
      meshes: [
        {
          name: `${this.projectName}_geometry`,
          primitives: [
            {
              attributes: {
                POSITION: 0,
                NORMAL: 1,
                TEXCOORD_0: 2,
              },
              indices: 3,
              material: textureDataUri ? 0 : undefined,
            },
          ],
        },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: this.mesh.vertices.length / 3,
          type: "VEC3",
          min: this.calculateMin(this.mesh.vertices, 3),
          max: this.calculateMax(this.mesh.vertices, 3),
        },
        {
          bufferView: 1,
          componentType: 5126,
          count: this.mesh.normals.length / 3,
          type: "VEC3",
        },
        {
          bufferView: 2,
          componentType: 5126,
          count: this.mesh.uvs.length / 2,
          type: "VEC2",
        },
        {
          bufferView: 3,
          componentType: 5125,
          count: this.mesh.indices.length,
          type: "SCALAR",
        },
      ],
      bufferViews: this.createBufferViews(),
      buffers: [
        {
          byteLength: this.calculateTotalBufferSize(),
          uri: this.createDataUri(),
        },
      ],
      ...(textureDataUri && {
        materials: [
          {
            name: `${this.projectName}_material`,
            pbrMetallicRoughness: {
              baseColorTexture: {
                index: 0,
              },
              metallicFactor: 0.0,
              roughnessFactor: 1.0,
            },
          },
        ],
        textures: [
          {
            source: 0,
          },
        ],
        images: [
          {
            name: `${this.projectName}_texture`,
            uri: textureDataUri,
          },
        ],
      }),
    };

    return JSON.stringify(gltf, null, 2);
  }

  private createBufferViews() {
    const verticesSize = this.mesh.vertices.length * 4;
    const normalsSize = this.mesh.normals.length * 4;
    const uvsSize = this.mesh.uvs.length * 4;
    const indicesSize = this.mesh.indices.length * 4;

    return [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: verticesSize,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: verticesSize,
        byteLength: normalsSize,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: verticesSize + normalsSize,
        byteLength: uvsSize,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: verticesSize + normalsSize + uvsSize,
        byteLength: indicesSize,
        target: 34963,
      },
    ];
  }

  private calculateTotalBufferSize(): number {
    return (
      this.mesh.vertices.length * 4 +
      this.mesh.normals.length * 4 +
      this.mesh.uvs.length * 4 +
      this.mesh.indices.length * 4
    );
  }

  private createDataUri(): string {
    const totalSize = this.calculateTotalBufferSize();
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    let offset = 0;

    for (let i = 0; i < this.mesh.vertices.length; i++) {
      view.setFloat32(offset, this.mesh.vertices[i], true);
      offset += 4;
    }

    for (let i = 0; i < this.mesh.normals.length; i++) {
      view.setFloat32(offset, this.mesh.normals[i], true);
      offset += 4;
    }

    for (let i = 0; i < this.mesh.uvs.length; i += 2) {
      view.setFloat32(offset, this.mesh.uvs[i], true);
      offset += 4;
      view.setFloat32(offset, 1.0 - this.mesh.uvs[i + 1], true);
      offset += 4;
    }

    for (let i = 0; i < this.mesh.indices.length; i++) {
      view.setUint32(offset, this.mesh.indices[i], true);
      offset += 4;
    }

    const uint8Array = new Uint8Array(buffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    return `data:application/octet-stream;base64,${btoa(binaryString)}`;
  }

  private calculateMin(array: number[], stride: number): number[] {
    const min = new Array(stride).fill(Infinity);
    for (let i = 0; i < array.length; i += stride) {
      for (let j = 0; j < stride; j++) {
        min[j] = Math.min(min[j], array[i + j]);
      }
    }
    return min;
  }

  private calculateMax(array: number[], stride: number): number[] {
    const max = new Array(stride).fill(-Infinity);
    for (let i = 0; i < array.length; i += stride) {
      for (let j = 0; j < stride; j++) {
        max[j] = Math.max(max[j], array[i + j]);
      }
    }
    return max;
  }
}
