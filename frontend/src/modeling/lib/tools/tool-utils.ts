import * as THREE from "three";
import type { BlockModificationMode } from "../../../module_bindings";

export function floorVector3(vector3: THREE.Vector3): THREE.Vector3 {
  vector3.x = Math.floor(vector3.x);
  vector3.y = Math.floor(vector3.y);
  vector3.z = Math.floor(vector3.z);
  return vector3;
}

export function calculateGridPositionWithMode(
  intersectionPoint: THREE.Vector3,
  normal: THREE.Vector3,
  mode: BlockModificationMode
): THREE.Vector3 {
  const multiplier = mode.tag === "Attach" ? 0.1 : -0.1;
  const adjustedPoint = intersectionPoint
    .clone()
    .add(normal.clone().multiplyScalar(multiplier));
  return floorVector3(adjustedPoint);
}
