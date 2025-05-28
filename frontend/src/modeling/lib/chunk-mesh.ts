import * as THREE from "three";
import { Chunk, PreviewVoxels } from "@/module_bindings";
import { layers } from "./layers";

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

  update(newChunk: Chunk, previewVoxels?: PreviewVoxels | null) {
    const previewPositions = new Set<string>();
    const previewAdditions = new Map<string, string>();

    if (previewVoxels && previewVoxels.previewPositions.length > 0) {
      previewVoxels.previewPositions.forEach((pos) => {
        const key = `${pos.x},${pos.y},${pos.z}`;
        previewPositions.add(key);
        if (previewVoxels.isAddMode) {
          previewAdditions.set(key, previewVoxels.blockColor);
        }
      });
    }

    let zIndex = 0;
    for (const blockRun of newChunk.blocks) {
      for (let i = 0; i < blockRun.count; i++) {
        const z = zIndex + i;
        const x = 0;
        const y = 0;
        const worldX = newChunk.x + x;
        const worldY = newChunk.y + y;
        const worldZ = z;

        const posKey = `${worldX},${worldY},${worldZ}`;
        const isInPreview = previewPositions.has(posKey);
        const isPreviewRemoval = isInPreview && !previewVoxels?.isAddMode;
        const isPreviewAddition = isInPreview && previewVoxels?.isAddMode;

        const currentMesh = this.blocks[x]?.[y]?.[z];
        const hasBlock = blockRun.type.tag !== "Empty";
        const shouldHaveBlock = hasBlock || isPreviewAddition;

        if (!shouldHaveBlock) {
          if (currentMesh) {
            this.scene.remove(currentMesh);
            this.blocks[x][y][z] = null;
          }
        } else {
          const displayColor = isPreviewAddition
            ? previewAdditions.get(posKey)!
            : blockRun.color;

          if (!currentMesh) {
            const material = isPreviewRemoval
              ? invisibleMaterial
              : getSharedMaterial(displayColor);
            const blockMesh = new THREE.Mesh(sharedGeometry, material);
            blockMesh.position.set(worldX + 0.5, worldZ + 0.5, worldY + 0.5);
            blockMesh.castShadow = true;
            blockMesh.receiveShadow = true;
            blockMesh.userData = {
              type: blockRun.type.tag,
              originalColor: blockRun.color,
              currentColor: displayColor,
            };
            if (isPreviewAddition) {
              blockMesh.layers.set(layers.ghost);
            } else {
              blockMesh.layers.set(layers.raycast);
            }
            this.scene.add(blockMesh);
            this.blocks[x][y][z] = blockMesh;
          } else {
            const needsMaterialUpdate =
              currentMesh.userData.currentColor !== displayColor ||
              (isPreviewRemoval &&
                currentMesh.material !== invisibleMaterial) ||
              (!isPreviewRemoval && currentMesh.material === invisibleMaterial);

            if (needsMaterialUpdate) {
              const newMaterial = isPreviewRemoval
                ? invisibleMaterial
                : getSharedMaterial(displayColor);
              currentMesh.material = newMaterial;
              currentMesh.userData.currentColor = displayColor;
            }

            if (isPreviewAddition) {
              currentMesh.layers.set(layers.ghost);
            } else {
              currentMesh.layers.set(layers.raycast);
            }

            if (
              currentMesh.userData.type !== blockRun.type.tag ||
              currentMesh.userData.originalColor !== blockRun.color
            ) {
              currentMesh.userData.type = blockRun.type.tag;
              currentMesh.userData.originalColor = blockRun.color;
            }
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
