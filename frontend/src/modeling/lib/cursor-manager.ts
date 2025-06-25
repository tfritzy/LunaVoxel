import * as THREE from "three";
import { Vector3, DbConnection } from "../../module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import { layers } from "./layers";

export interface PlayerCursor {
  id: string;
  projectId: string;
  player: Identity;
  position: Vector3;
  normal: Vector3;
}

export class CursorManager {
  private scene: THREE.Scene;
  private cursors: Map<string, THREE.Mesh> = new Map();
  private playerColors: Map<string, THREE.Color> = new Map();
  private colorIndex: number = 0;
  private projectId: string;

  private readonly CURSOR_COLORS = [
    new THREE.Color(0xff6b6b),
    new THREE.Color(0x4ecdc4),
    new THREE.Color(0x45b7d1),
    new THREE.Color(0xf9ca24),
    new THREE.Color(0xf0932b),
    new THREE.Color(0xeb4d4b),
    new THREE.Color(0x6c5ce7),
    new THREE.Color(0xa29bfe),
    new THREE.Color(0xfd79a8),
    new THREE.Color(0x00b894),
  ];

  constructor(scene: THREE.Scene, projectId: string) {
    this.scene = scene;
    this.projectId = projectId;
  }

  updateFromDatabase(dbConn: DbConnection): void {
    const cursors: PlayerCursor[] = [];

    for (const cursor of dbConn.db.playerCursor.tableCache.iter()) {
      const c = cursor as PlayerCursor;
      if (c.projectId === this.projectId) {
        cursors.push(c);
      }
    }

    this.update(cursors);
  }

  private update(cursors: PlayerCursor[]): void {
    const activeCursorIds = new Set<string>();

    for (const cursor of cursors) {
      activeCursorIds.add(cursor.id);

      const existingMesh = this.cursors.get(cursor.id);

      if (existingMesh) {
        const newPosition = new THREE.Vector3(
          cursor.position.x,
          cursor.position.y,
          cursor.position.z
        );
        const newNormal = new THREE.Vector3(
          cursor.normal.x,
          cursor.normal.y,
          cursor.normal.z
        );

        if (
          !existingMesh.position.equals(newPosition) ||
          !this.getMeshNormal(existingMesh).equals(newNormal)
        ) {
          existingMesh.position.copy(newPosition);
          this.orientCursorToNormal(existingMesh, cursor.normal);
        }
      } else {
        this.createCursor(cursor);
      }
    }

    for (const [cursorId, mesh] of this.cursors) {
      if (!activeCursorIds.has(cursorId)) {
        this.removeCursor(cursorId);
      }
    }
  }

  private getMeshNormal(mesh: THREE.Mesh): THREE.Vector3 {
    const direction = new THREE.Vector3();
    mesh.getWorldDirection(direction);
    return direction.negate();
  }

  private createCursor(cursor: PlayerCursor): void {
    const geometry = new THREE.PlaneGeometry(1, 1);

    const playerKey = cursor.player.toHexString();
    let color = this.playerColors.get(playerKey);

    if (!color) {
      color = this.CURSOR_COLORS[this.colorIndex % this.CURSOR_COLORS.length];
      this.playerColors.set(playerKey, color);
      this.colorIndex++;
    }

    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cursor.position.x, cursor.position.y, cursor.position.z);
    mesh.layers.set(layers.ghost);

    this.orientCursorToNormal(mesh, cursor.normal);

    this.cursors.set(cursor.id, mesh);
    this.scene.add(mesh);
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
  }
}
