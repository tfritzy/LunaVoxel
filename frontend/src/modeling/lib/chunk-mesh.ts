import * as THREE from "three";
import { Chunk } from "@/module_bindings";
import { createBlockModel } from "@/modeling/blocks";
import { layers } from "@/modeling/lib/layers";

export class ChunkMesh {
  private scene: THREE.Scene;
  private blocks: (THREE.Mesh | null)[][][];
  private ghostMaterial: THREE.Material;

  constructor(
    scene: THREE.Scene,
    width: number,
    height: number,
    length: number
  ) {
    this.scene = scene;
    this.blocks = [];
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: "#0096FF",
      opacity: 0.3,
      transparent: true,
      depthWrite: true,
      depthTest: true,
    });

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

  update(newChunk: Chunk) {
    let zIndex = 0;
    for (const blockRun of newChunk.blocks) {
      for (let i = 0; i < blockRun.count; i++) {
        const z = zIndex + i;
        const x = 0;
        const y = 0;

        const needsUpdate =
          !this.blocks[x]?.[y]?.[z] ||
          this.blocks[x][y][z]?.userData.type !== blockRun.type.tag ||
          this.blocks[x][y][z]?.userData.ghost !== blockRun.ghost ||
          this.blocks[x][y][z]?.userData.color !== blockRun.color;

        if (blockRun.type.tag === "Empty") {
          if (this.blocks[x]?.[y]?.[z]) {
            this.scene.remove(this.blocks[x][y][z]!);
            this.blocks[x][y][z] = null;
          }
        } else if (needsUpdate) {
          if (this.blocks[x]?.[y]?.[z]) {
            this.scene.remove(this.blocks[x][y][z]!);
            this.blocks[x][y][z] = null;
          }

          const blockMesh = createBlockModel(blockRun.type, blockRun.color);
          if (blockMesh) {
            blockMesh.position.set(
              newChunk.x + x + 0.5,
              z + 0.5,
              newChunk.y + y + 0.5
            );

            if (blockRun.ghost) {
              blockMesh.castShadow = false;
              blockMesh.layers.set(layers.ghost);
              blockMesh.material = this.ghostMaterial;
            } else {
              blockMesh.castShadow = true;
            }

            this.scene.add(blockMesh);
            this.blocks[x][y][z] = blockMesh;
          }
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
