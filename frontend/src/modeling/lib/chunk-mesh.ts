import * as THREE from "three";
import { Chunk, PreviewVoxels } from "@/module_bindings";
import { layers } from "./layers";

const sharedGeometry = new THREE.BoxGeometry(1, 1, 1);
const previewMaterialAdd = new THREE.MeshStandardMaterial({
  color: 0x0066ff,
  roughness: 0.7,
  metalness: 0.2,
});
const previewMaterialRemove = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  roughness: 0.7,
  metalness: 0.2,
});
const sharedMaterials = new Map<string, THREE.MeshStandardMaterial>();

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
  private previewInstances: THREE.InstancedMesh | null = null;

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

          const material = getSharedMaterial(blockRun.color);
          const blockMesh = new THREE.Mesh(sharedGeometry, material);
          blockMesh.position.set(
            newChunk.x + x + 0.5,
            z + 0.5,
            newChunk.y + y + 0.5
          );
          blockMesh.castShadow = false;
          blockMesh.userData = {
            type: blockRun.type.tag,
            color: blockRun.color,
          };
          this.scene.add(blockMesh);
          this.blocks[x][y][z] = blockMesh;
        }
      }
      zIndex += blockRun.count;
    }
  }

  updatePreview(previewVoxels: PreviewVoxels | null) {
    this.clearPreview();

    if (!previewVoxels || previewVoxels.previewPositions.length === 0) {
      return;
    }

    const validPositions = previewVoxels.previewPositions.filter((pos) => {
      const existingBlock = this.getBlockAt(pos.x, pos.y, pos.z);

      if (previewVoxels.isAddMode) {
        return !existingBlock;
      } else {
        return !!existingBlock;
      }
    });

    if (validPositions.length === 0) {
      return;
    }

    const material = previewVoxels.isAddMode
      ? previewMaterialAdd
      : previewMaterialRemove;
    this.previewInstances = new THREE.InstancedMesh(
      sharedGeometry,
      material,
      validPositions.length
    );
    this.previewInstances.layers.set(layers.ghost);

    const matrix = new THREE.Matrix4();
    validPositions.forEach((pos, index) => {
      matrix.setPosition(pos.x + 0.5, pos.z + 0.5, pos.y + 0.5);
      this.previewInstances!.setMatrixAt(index, matrix);
    });

    this.previewInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.previewInstances);
  }

  private getBlockAt(x: number, y: number, z: number): THREE.Mesh | null {
    return this.blocks[x]?.[y]?.[z] || null;
  }

  private clearPreview() {
    if (this.previewInstances) {
      this.scene.remove(this.previewInstances);
      this.previewInstances = null;
    }
  }

  dispose() {
    this.clearPreview();

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
