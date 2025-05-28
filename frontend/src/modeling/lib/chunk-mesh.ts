import * as THREE from "three";
import { Chunk } from "@/module_bindings";

const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
const sharedMaterials = new Map<string, THREE.MeshStandardMaterial>();
const invisibleMaterial = new THREE.MeshStandardMaterial({
  visible: false,
});

function getSharedMaterial(color: string): THREE.MeshStandardMaterial {
  if (!sharedMaterials.has(color)) {
    const material = new THREE.MeshStandardMaterial({
      color: parseInt(color.replace("#", ""), 16),
      roughness: 0.7,
      metalness: 0.2,
    });
    sharedMaterials.set(color, material);
  }
  return sharedMaterials.get(color)!;
}

export class ChunkMesh {
  private scene: THREE.Scene;
  private blocks: (THREE.Mesh | null)[][][];

  constructor(
    scene: THREE.Scene,
    width: number,
    height: number,
    length: number
  ) {
    this.scene = scene;
    this.blocks = [];

    for (let x = 0; x < width; x++) {
      this.blocks[x] = [];
      for (let y = 0; y < height; y++) {
        this.blocks[x][y] = [];
        for (let z = 0; z < length; z++) {
          this.blocks[x][y][z] = null;
        }
      }
    }
  }

  update(
    chunk: Chunk,
    previewMap: Map<string, { color: string; isAddMode: boolean }>
  ) {
    let zIndex = 0;
    for (const blockRun of chunk.blocks) {
      for (let z = zIndex; z < blockRun.count + zIndex; z++) {
        const currentBlock = this.blocks[0][0][z];
        const isPreview = previewMap.has(`${chunk.x},${chunk.y},${z}`);
        if (!isPreview) {
          if (currentBlock && blockRun.type.tag === "Empty") {
            this.scene.remove(currentBlock);
            this.blocks[0][0][z] = null;
          } else if (blockRun.type.tag !== "Empty" && !currentBlock) {
            const material = getSharedMaterial(blockRun.color);
            const blockMesh = new THREE.Mesh(sharedGeometry, material);
            blockMesh.position.set(chunk.x + 0.5, z + 0.5, chunk.y + 0.5);
            blockMesh.castShadow = true;
            blockMesh.receiveShadow = true;
            this.scene.add(blockMesh);
            this.blocks[0][0][z] = blockMesh;
          }
        } else {
        }
      }
      zIndex += blockRun.count;
    }
  }

  dispose() {
    for (let x = 0; x < this.blocks.length; x++) {
      for (let y = 0; y < this.blocks[x]?.length || 0; y++) {
        for (let z = 0; z < this.blocks[x]?.[y]?.length || 0; z++) {
          if (this.blocks[x]?.[y]?.[z]) {
            this.scene.remove(this.blocks[x][y][z]!);
            this.blocks[x][y][z] = null;
          }
        }
      }
    }

    this.blocks = [];
  }
}
