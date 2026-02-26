import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import { RAYCASTABLE_BIT } from "../voxel-constants";

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

export function getBlockValue(mode: BlockModificationMode, selectedBlock: number): number {
  switch (mode.tag) {
    case "Attach":
      return selectedBlock;
    case "Paint":
      return selectedBlock | RAYCASTABLE_BIT;
    case "Erase":
      return RAYCASTABLE_BIT;
  }
}
