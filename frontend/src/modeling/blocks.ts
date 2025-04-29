import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type Block = {
  name: string;
  modelPath: string;
  dimensions: THREE.Vector3;
  validRotations: number[];
};

export const blocks: Block[] = [
  {
    name: "Small Block",
    modelPath: "models/small-block.glb",
    dimensions: new THREE.Vector3(1, 1, 1),
    validRotations: [0],
  },
  {
    name: "Long Block",
    modelPath: "models/long-block.glb",
    dimensions: new THREE.Vector3(2, 1, 1),
    validRotations: [0, Math.PI / 2],
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
