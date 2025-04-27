import { BufferGeometry, Material, Vector3 } from "three";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type Block = {
  material: Material;
  geometry: BufferGeometry;
};

type BlockProps = {
  dimensions: Vector3;
  rounded: boolean;
  color: string;
};

const blockProps: BlockProps[] = [
  {
    dimensions: new Vector3(1, 1, 1),
    color: "#acaeaf",
    rounded: true,
  },
  {
    dimensions: new Vector3(2, 1, 1),
    color: "#acaeaf",
    rounded: true,
  },
];

export const blocks: Block[] = blockProps.map((bp) => {
  const geometry = new RoundedBoxGeometry(
    bp.dimensions.x,
    bp.dimensions.y,
    bp.dimensions.z,
    3,
    0.07
  );
  const material = new THREE.MeshStandardMaterial({
    color: bp.color,
    roughness: 0.5,
    metalness: 0.5,
  });

  return {
    material: material,
    geometry: geometry,
  };
});
