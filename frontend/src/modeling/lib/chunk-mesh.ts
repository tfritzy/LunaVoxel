import * as THREE from "three";
import { BlockRun, Chunk, PreviewVoxels } from "@/module_bindings";
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

  decompressBlocks(blocks: BlockRun[]): (BlockRun | undefined)[][][] {
    const decompressed: (BlockRun | undefined)[][][] = [];
    for (const blockRun of blocks) {
      const { topLeft, bottomRight } = blockRun;
      for (let x = topLeft.x; x <= bottomRight.x; x++) {
        if (!decompressed[x]) decompressed[x] = [];
        for (let y = topLeft.y; y <= bottomRight.y; y++) {
          if (!decompressed[x][y]) decompressed[x][y] = [];
          for (let z = topLeft.z; z <= bottomRight.z; z++) {
            if (!decompressed[x][y][z]) {
              decompressed[x][y][z] = blockRun;
            }
          }
        }
      }
    }

    return decompressed;
  }

  update(newChunk: Chunk, previewVoxels?: PreviewVoxels | null) {
    console.log("Updating mesh to ", newChunk);
    const targetBlocks = this.decompressBlocks(newChunk.blocks);
    const previewBlocks = previewVoxels
      ? this.decompressBlocks(previewVoxels.previewPositions)
      : null;

    const chunkWidth = this.blocks.length;
    const chunkHeight = chunkWidth > 0 ? this.blocks[0].length : 0;
    const chunkLength = chunkHeight > 0 ? this.blocks[0][0].length : 0;

    for (let x = 0; x < chunkWidth; x++) {
      for (let y = 0; y < chunkHeight; y++) {
        for (let z = 0; z < chunkLength; z++) {
          const run = targetBlocks[x]?.[y]?.[z];
          const previewRun = previewBlocks
            ? previewBlocks[x]?.[y]?.[z]
            : undefined;
          const existingMesh = this.blocks[x]?.[y]?.[z];

          let displayRun: BlockRun | undefined = run;
          let useInvisibleMaterial = false;
          let finalLayer = layers.raycast; // Default layer

          if (previewVoxels) {
            if (previewVoxels.isAddMode) {
              // Add or Modify Preview
              if (previewRun) {
                displayRun = previewRun; // The preview determines what's shown
                finalLayer = layers.ghost; // Add/modify previews are on the ghost layer
              }
              // If no previewRun in add mode, displayRun remains 'run', layer raycast (default)
            } else {
              // Removal Preview
              if (previewRun && run) {
                // Previewing removal of an existing block 'run'.
                // displayRun remains 'run' because its properties (color, type) are needed for userData.
                useInvisibleMaterial = true; // Make it invisible.
                finalLayer = layers.raycast; // Keep it raycastable.
              } else if (previewRun && !run) {
                // Previewing removal of an empty spot - effectively, no block to display.
                displayRun = undefined;
              }
              // If no previewRun in removal mode, displayRun remains 'run', layer raycast.
            }
          }

          if (displayRun) {
            const materialColor = displayRun.color || "#ffffff";
            const typeTag = displayRun.type.tag;

            const currentDisplayMaterial = useInvisibleMaterial
              ? invisibleMaterial
              : getSharedMaterial(materialColor);

            // Determine the source for originalColor and originalType in userData.
            // If 'run' (the actual block from targetBlocks) exists, that's the original.
            // Otherwise (it's a new block being added via preview), 'displayRun' is its own original.
            const originalDataSource = run || displayRun;
            const trueOriginalColor = originalDataSource.color || "#ffffff";
            const trueOriginalType = originalDataSource.type.tag;

            if (existingMesh) {
              // Update existing mesh
              if (existingMesh.material !== currentDisplayMaterial) {
                existingMesh.material = currentDisplayMaterial;
              }
              if (existingMesh.layers.mask !== 1 << finalLayer) {
                existingMesh.layers.set(finalLayer);
              }

              // userData.currentColor should reflect the color of 'displayRun',
              // even if it's invisible (it's the color it *would* be).
              if (existingMesh.userData.currentColor !== materialColor) {
                existingMesh.userData.currentColor = materialColor;
              }
              if (existingMesh.userData.type !== trueOriginalType) {
                existingMesh.userData.type = trueOriginalType;
              }
              if (existingMesh.userData.originalColor !== trueOriginalColor) {
                existingMesh.userData.originalColor = trueOriginalColor;
              }
            } else {
              // Create new mesh
              const blockMesh = new THREE.Mesh(
                sharedGeometry,
                currentDisplayMaterial
              );
              blockMesh.position.set(x + 0.5, z + 0.5, y + 0.5); // Assuming your coordinate mapping
              blockMesh.castShadow = !useInvisibleMaterial; // Invisible blocks don't cast shadows
              blockMesh.receiveShadow = true;
              blockMesh.layers.set(finalLayer);
              blockMesh.userData = {
                type: trueOriginalType,
                currentColor: materialColor,
                originalColor: trueOriginalColor, // For a new block, original is same as current from its perspective
              };
              this.scene.add(blockMesh);
              this.blocks[x][y][z] = blockMesh;
            }
          } else {
            // No displayRun means no block should be here
            if (existingMesh) {
              this.scene.remove(existingMesh);
              this.blocks[x][y][z] = null;
            }
          }
        }
      }
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
