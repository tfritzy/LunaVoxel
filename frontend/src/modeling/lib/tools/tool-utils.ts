import * as THREE from "three";

/**
 * Floor all components of a Vector3
 * Note: This function mutates the input vector
 * @param vector3 - The vector to floor (will be modified in place)
 * @returns The same vector instance with floored components
 */
export function floorVector3(vector3: THREE.Vector3): THREE.Vector3 {
  vector3.x = Math.floor(vector3.x);
  vector3.y = Math.floor(vector3.y);
  vector3.z = Math.floor(vector3.z);
  return vector3;
}
