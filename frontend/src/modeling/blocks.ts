import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BlockType } from "../module_bindings";

export type Block = {
  type: BlockType;
  name: string;
  modelPath: string;
  dimensions: THREE.Vector3;
  validRotations: number[];
};

export const blocks: Block[] = [
  {
    type: { tag: "Block" },
    name: "Small Block",
    modelPath: "models/block.glb",
    dimensions: new THREE.Vector3(1, 1, 1),
    validRotations: [0],
  },
  {
    type: { tag: "RoundBlock" },
    name: "Long Block",
    modelPath: "models/round-block.glb",
    dimensions: new THREE.Vector3(2, 1, 1),
    validRotations: [0],
  },
];

const loader = new GLTFLoader();

export function loadModel(path: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        resolve(model);
      },
      (xhr) => console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`),
      (error) => reject(error)
    );
  });
}
