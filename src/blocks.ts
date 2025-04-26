import { BufferGeometry, Material, Vector3 } from "three";

export type Block = {
  dimensions: Vector3;
  material: Material;
  geometry: BufferGeometry;
};

type BlockProps = {};

export const blocks = [{}];

const blockProps = [{}];
