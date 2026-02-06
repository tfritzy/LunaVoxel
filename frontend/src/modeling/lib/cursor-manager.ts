import * as THREE from "three";
import { layers } from "./layers";
import { globalStore, type Vector3 } from "@/state";

export const CURSOR_COLORS = [
  new THREE.Color("#EE5A32"),
  new THREE.Color("#3FA34D"),
  new THREE.Color("#3F6FE4"),
  new THREE.Color("#E2B534"),
  new THREE.Color("#15B2A7"),
  new THREE.Color("#C545A7"),
  new THREE.Color("#9F5BFF"),
  new THREE.Color("#FF6FAE"),
  new THREE.Color("#5CC9FF"),
  new THREE.Color("#7DDB4B"),
];

export class CursorManager {
  private scene: THREE.Scene;
  private cursors: Map<string, THREE.Mesh> = new Map();
  private playerColors: Map<string, THREE.Color> = new Map();
  private colorIndex: number = 0;
  private localCursorMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  updateLocalCursor(position: THREE.Vector3, normal: THREE.Vector3): void {
    const state = globalStore.getState();
    if (!state.currentUserId) return;

    if (!this.localCursorMesh) {
      this.createLocalCursorMesh();
    }

    if (this.localCursorMesh) {
      this.localCursorMesh.position.set(position.x, position.y, position.z);
      this.orientCursorToNormal(this.localCursorMesh, {
        x: normal.x,
        y: normal.y,
        z: normal.z,
      });
    }
  }

  private createLocalCursorMesh(): void {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const color = new THREE.Color("#ffffff");

    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    this.localCursorMesh = new THREE.Mesh(geometry, material);
    this.localCursorMesh.layers.set(layers.ghost);
    this.scene.add(this.localCursorMesh);
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

  private removeCursor(cursorId: string): void {
    const mesh = this.cursors.get(cursorId);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.cursors.delete(cursorId);
    }
  }

  dispose(): void {
    for (const [cursorId] of this.cursors) {
      this.removeCursor(cursorId);
    }
    this.cursors.clear();
    this.playerColors.clear();

    if (this.localCursorMesh) {
      this.scene.remove(this.localCursorMesh);
      this.localCursorMesh.geometry.dispose();
      (this.localCursorMesh.material as THREE.Material).dispose();
      this.localCursorMesh = null;
    }
  }
}
