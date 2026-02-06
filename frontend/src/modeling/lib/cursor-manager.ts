import * as THREE from "three";
import type { Vector3 } from "@/state/types";
import { layers } from "./layers";

export const CURSOR_COLORS = [
  new THREE.Color("#EE5A32"), // Vivid Orange
  new THREE.Color("#3FA34D"), // Leaf Green
  new THREE.Color("#3F6FE4"), // Azure Blue
  new THREE.Color("#E2B534"), // Warm Gold
  new THREE.Color("#15B2A7"), // Teal
  new THREE.Color("#C545A7"), // Magenta
  new THREE.Color("#9F5BFF"), // Violet
  new THREE.Color("#FF6FAE"), // Pink
  new THREE.Color("#5CC9FF"), // Sky Cyan
  new THREE.Color("#7DDB4B"), // Lime
];

export class CursorManager {
  private scene: THREE.Scene;
  private localCursor: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  updateLocalCursor(position: THREE.Vector3, normal: THREE.Vector3): void {
    if (this.localCursor) {
      this.localCursor.position.set(position.x, position.y, position.z);
      this.orientCursorToNormal(this.localCursor, normal);
      return;
    }

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: CURSOR_COLORS[0],
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.layers.set(layers.ghost);
    mesh.position.set(position.x, position.y, position.z);
    this.orientCursorToNormal(mesh, normal);
    this.scene.add(mesh);
    this.localCursor = mesh;
  }

  private orientCursorToNormal(mesh: THREE.Mesh, normal: Vector3): void {
    const normalVector = new THREE.Vector3(normal.x, normal.y, normal.z);
    normalVector.normalize();

    const basePosition = new THREE.Vector3(
      mesh.position.x,
      mesh.position.y,
      mesh.position.z
    );

    const offset = normalVector.clone().multiplyScalar(0.01);
    mesh.position.copy(basePosition).add(offset);

    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 0, 1);

    if (Math.abs(normalVector.dot(up)) > 0.99) {
      up.set(0, 1, 0);
    }

    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalVector);
    mesh.setRotationFromQuaternion(quaternion);
  }

  dispose(): void {
    if (this.localCursor) {
      this.scene.remove(this.localCursor);
      this.localCursor.geometry.dispose();
      (this.localCursor.material as THREE.Material).dispose();
      this.localCursor = null;
    }
  }
}
