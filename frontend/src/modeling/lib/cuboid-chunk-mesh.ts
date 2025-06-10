import * as THREE from "three";
import { BlockRun, Chunk, PreviewVoxels } from "@/module_bindings";

export class CuboidChunkMesh {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.MeshLambertMaterial | null = null;
  private currentUpdateId: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async update(
    newChunk: Chunk,
    previewVoxels?: PreviewVoxels | null,
    signal?: AbortSignal
  ): Promise<void> {
    const updateId = ++this.currentUpdateId;

    if (signal?.aborted) {
      return;
    }

    try {
      await this.updateMesh(newChunk.blocks, signal, updateId);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      throw error;
    }
  }

  private async updateMesh(
    blocks: BlockRun[],
    signal?: AbortSignal,
    updateId?: number
  ): Promise<void> {
    if (signal?.aborted || (updateId && updateId !== this.currentUpdateId)) {
      throw new DOMException("Operation aborted", "AbortError");
    }

    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    let vertexOffset = 0;
    let processedBlocks = 0;
    const checkInterval = 50;

    for (const blockRun of blocks) {
      if (signal?.aborted || (updateId && updateId !== this.currentUpdateId)) {
        throw new DOMException("Operation aborted", "AbortError");
      }

      if (++processedBlocks % checkInterval === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const { topLeft, bottomRight, color } = blockRun;

      const width = bottomRight.x - topLeft.x + 1;
      const height = bottomRight.y - topLeft.y + 1;
      const depth = bottomRight.z - topLeft.z + 1;

      const centerX = (topLeft.x + bottomRight.x) / 2 + 0.5;
      const centerY = (topLeft.y + bottomRight.y) / 2 + 0.5;
      const centerZ = (topLeft.z + bottomRight.z) / 2 + 0.5;

      const boxGeometry = new THREE.BoxGeometry(width, height, depth);
      const boxVertices = boxGeometry.attributes.position.array as Float32Array;
      const boxNormals = boxGeometry.attributes.normal.array as Float32Array;
      const boxIndices = boxGeometry.index?.array as Uint16Array;

      const colorObj = new THREE.Color(color || "#ffffff");

      for (let i = 0; i < boxVertices.length; i += 3) {
        vertices.push(
          boxVertices[i] + centerX,
          boxVertices[i + 1] + centerY,
          boxVertices[i + 2] + centerZ
        );
        colors.push(colorObj.r, colorObj.g, colorObj.b);
      }

      for (let i = 0; i < boxNormals.length; i++) {
        normals.push(boxNormals[i]);
      }

      for (let i = 0; i < boxIndices.length; i++) {
        indices.push(boxIndices[i] + vertexOffset);
      }

      vertexOffset += boxVertices.length / 3;

      boxGeometry.dispose();
    }

    if (signal?.aborted || (updateId && updateId !== this.currentUpdateId)) {
      throw new DOMException("Operation aborted", "AbortError");
    }

    if (!this.geometry) {
      this.geometry = new THREE.BufferGeometry();
      this.material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.FrontSide,
      });
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.scene.add(this.mesh);
    }

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    this.geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    this.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );
    this.geometry.setIndex(indices);

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    if (this.geometry.index) {
      this.geometry.index.needsUpdate = true;
    }

    this.geometry.computeBoundingSphere();
  }

  dispose() {
    this.currentUpdateId++;

    if (this.mesh) {
      this.scene.remove(this.mesh);

      if (this.geometry) {
        this.geometry.dispose();
        this.geometry = null;
      }

      if (this.material) {
        this.material.dispose();
        this.material = null;
      }

      this.mesh = null;
    }
  }
}
