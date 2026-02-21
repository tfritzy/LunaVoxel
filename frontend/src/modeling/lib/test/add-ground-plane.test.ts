import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { updateBoundsVisibility } from "../add-ground-plane";

function createEdge(face1Normal: THREE.Vector3) {
  return {
    mesh: new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x606060, transparent: true })
    ),
    face0Center: new THREE.Vector3(0, 0, 0),
    face0Normal: new THREE.Vector3(1, 0, 0),
    face1Center: new THREE.Vector3(0, 0, 0),
    face1Normal,
  };
}

describe("updateBoundsVisibility", () => {
  it("keeps front-facing edges fully opaque with the default edge color", () => {
    const edge = createEdge(new THREE.Vector3(0, 1, 0));
    updateBoundsVisibility(new THREE.Vector3(1, 1, 0), [edge]);
    const material = edge.mesh.material as THREE.MeshBasicMaterial;

    expect(edge.mesh.visible).toBe(true);
    expect(material.opacity).toBe(1);
    expect(material.color.getHex()).toBe(0x606060);
  });

  it("dims back-facing edges to 25% opacity and uses a brighter color", () => {
    const edge = createEdge(new THREE.Vector3(0, -1, 0));
    updateBoundsVisibility(new THREE.Vector3(1, 1, 0), [edge]);
    const material = edge.mesh.material as THREE.MeshBasicMaterial;

    expect(edge.mesh.visible).toBe(true);
    expect(material.opacity).toBe(0.25);
    expect(material.color.getHex()).toBe(0xc0c0c0);
  });
});
