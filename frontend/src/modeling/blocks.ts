import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BlockType } from "../module_bindings";

export type Block = {
  type: BlockType;
  name: string;
  dimensions: THREE.Vector3;
  validRotations: number[];
};

export const blocks: Block[] = [
  {
    type: { tag: "Block" },
    name: "Standard Block",
    dimensions: new THREE.Vector3(1, 1, 1),
    validRotations: [0],
  },
  {
    type: { tag: "RoundBlock" },
    name: "Round Block",
    dimensions: new THREE.Vector3(1, 1, 1),
    validRotations: [0],
  },
];

const resourceCache = {
  geometries: {
    box: new THREE.BoxGeometry(1, 1, 1),
    roundedBox: new RoundedBoxGeometry(1, 1, 1, 2, 0.15),
  },
  materials: {
    byColor: new Map<string, THREE.MeshStandardMaterial>(),
  },
};

/**
 * Get or create a material with the specified color
 */
function getMaterial(color: string): THREE.MeshStandardMaterial {
  if (resourceCache.materials.byColor.has(color)) {
    return resourceCache.materials.byColor.get(color)!;
  }

  const material = new THREE.MeshStandardMaterial({
    color: parseInt(color.replace("#", ""), 16),
    roughness: 0.7,
    metalness: 0.2,
  });

  resourceCache.materials.byColor.set(color, material);

  return material;
}

/**
 * Creates a standard cube mesh using shared resources
 */
export function createCubeMesh(color: string = "#ffffff"): THREE.Mesh {
  const geometry = resourceCache.geometries.box;

  const material = getMaterial(color);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates a rounded cube mesh using shared resources
 */
export function createRoundedCubeMesh(color: string = "#ffffff"): THREE.Mesh {
  const geometry = resourceCache.geometries.roundedBox!;

  const material = getMaterial(color);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates a block model based on block type
 */
export function createBlockModel(
  blockType: BlockType,
  color: string
): THREE.Mesh | null {
  if (blockType.tag === "Block") {
    return createCubeMesh(color);
  } else if (blockType.tag === "RoundBlock") {
    return createRoundedCubeMesh(color);
  } else if (blockType.tag === "Empty") {
    return null;
  }

  console.warn(
    `Unknown block type: ${blockType}, falling back to standard block`
  );
  return createCubeMesh();
}
