import * as THREE from "three";

export function wrapCoord(val: number, dim: number): number {
  return ((val % dim) + dim) % dim;
}

export function floorVector3(vector3: THREE.Vector3): THREE.Vector3 {
  vector3.x = Math.floor(vector3.x);
  vector3.y = Math.floor(vector3.y);
  vector3.z = Math.floor(vector3.z);
  return vector3;
}

export function calculateGridPositionWithMode(
  gridPosition: THREE.Vector3,
  normal: THREE.Vector3,
  mode: "under" | "above"
): THREE.Vector3 {
  if (mode === "above") {
    return gridPosition.clone().add(normal);
  }
  return gridPosition.clone();
}
