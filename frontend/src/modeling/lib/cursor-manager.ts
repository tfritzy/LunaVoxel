import * as THREE from "three";
import { Vector3, DbConnection } from "../../module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

export interface PlayerCursor {
  id: string;
  projectId: string;
  player: Identity;
  position: Vector3;
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
        existingMesh.position.set(
          cursor.position.x,
          cursor.position.y,
          cursor.position.z
        );
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

  private createCursor(cursor: PlayerCursor): void {
    const geometry = new THREE.SphereGeometry(0.1, 8, 6);

    const playerKey = cursor.player.toString();
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
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cursor.position.x, cursor.position.y, cursor.position.z);

    this.cursors.set(cursor.id, mesh);
    this.scene.add(mesh);
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
