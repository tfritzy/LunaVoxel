import * as THREE from "three";
import { layers } from "./layers";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type BoundsFace = {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  inwardNormal: THREE.Vector3;
};

const _toCamera = new THREE.Vector3();

export function updateBoundsVisibility(
  cameraPos: THREE.Vector3,
  faces: BoundsFace[]
): void {
  for (const face of faces) {
    _toCamera.subVectors(cameraPos, face.center);
    face.mesh.visible = face.inwardNormal.dot(_toCamera) > 0;
  }
}

export const addGroundPlane = (
  scene: THREE.Scene,
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
) => {
  const raycastMultiplier = 10;
  const raycastXDim = worldXDim * raycastMultiplier;
  const raycastYDim = worldYDim * raycastMultiplier;
  const raycastZDim = worldZDim * raycastMultiplier;

  const boundaryPlanes = createBoundaryPlanes(
    raycastXDim,
    raycastYDim,
    raycastZDim
  );
  boundaryPlanes.forEach((plane) => {
    scene.add(plane);
  });

  const wireframeBox = createWireframeBox(worldXDim, worldYDim, worldZDim);
  if (wireframeBox) {
    scene.add(wireframeBox);
  }

  const faceNames = [
    "bottom",
    "top",
    "front",
    "back",
    "left",
    "right",
  ] as const;
  const faces: BoundsFace[] = [];
  for (const faceName of faceNames) {
    const face = createFaceGridLines(faceName, worldXDim, worldYDim, worldZDim);
    if (face) {
      scene.add(face.mesh);
      faces.push(face);
    }
  }

  return {
    boundaryPlanes,
    wireframeBox,
    faces,
  };
};

const createBoundaryPlanes = (
  raycastXDim: number,
  raycastYDim: number,
  raycastZDim: number
): THREE.Mesh[] => {
  const planes: THREE.Mesh[] = [];
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.FrontSide,
    color: 0xff0000,
  });

  const worldXDim = raycastXDim / 10;
  const worldYDim = raycastYDim / 10;
  const worldZDim = raycastZDim / 10;

  const frontGeometry = new THREE.PlaneGeometry(raycastXDim, raycastZDim);
  const frontPlane = new THREE.Mesh(frontGeometry, material.clone());
  frontPlane.rotation.y = 2 * Math.PI;
  frontPlane.position.set(worldXDim / 2, worldZDim / 2, 0);
  frontPlane.layers.set(layers.raycast);
  frontPlane.userData.isBoundaryPlane = true;
  frontPlane.userData.side = "front";
  planes.push(frontPlane);

  const backGeometry = new THREE.PlaneGeometry(raycastXDim, raycastZDim);
  const backPlane = new THREE.Mesh(backGeometry, material.clone());
  backPlane.rotation.y = -Math.PI;
  backPlane.position.set(worldXDim / 2, worldZDim / 2, worldYDim);
  backPlane.layers.set(layers.raycast);
  backPlane.userData.isBoundaryPlane = true;
  backPlane.userData.side = "back";
  planes.push(backPlane);

  const leftGeometry = new THREE.PlaneGeometry(raycastYDim, raycastZDim);
  const leftPlane = new THREE.Mesh(leftGeometry, material.clone());
  leftPlane.rotation.y = Math.PI / 2;
  leftPlane.position.set(0, worldZDim / 2, worldYDim / 2);
  leftPlane.layers.set(layers.raycast);
  leftPlane.userData.isBoundaryPlane = true;
  leftPlane.userData.side = "left";
  planes.push(leftPlane);

  const rightGeometry = new THREE.PlaneGeometry(raycastYDim, raycastZDim);
  const rightPlane = new THREE.Mesh(rightGeometry, material.clone());
  rightPlane.rotation.y = -Math.PI / 2;
  rightPlane.position.set(worldXDim, worldZDim / 2, worldYDim / 2);
  rightPlane.layers.set(layers.raycast);
  rightPlane.userData.isBoundaryPlane = true;
  rightPlane.userData.side = "right";
  planes.push(rightPlane);

  const bottomGeometry = new THREE.PlaneGeometry(raycastXDim, raycastYDim);
  const bottomPlane = new THREE.Mesh(bottomGeometry, material.clone());
  bottomPlane.rotation.x = -Math.PI / 2;
  bottomPlane.position.set(worldXDim / 2, 0.000001, worldYDim / 2);
  bottomPlane.layers.set(layers.raycast);
  bottomPlane.userData.isBoundaryPlane = true;
  bottomPlane.userData.side = "bottom";
  planes.push(bottomPlane);

  const topGeometry = new THREE.PlaneGeometry(raycastXDim, raycastYDim);
  const topPlane = new THREE.Mesh(topGeometry, material.clone());
  topPlane.rotation.x = Math.PI / 2;
  topPlane.position.set(worldXDim / 2, worldZDim - 0.000001, worldYDim / 2);
  topPlane.layers.set(layers.raycast);
  topPlane.userData.isBoundaryPlane = true;
  topPlane.userData.side = "top";
  planes.push(topPlane);

  return planes;
};

const createWireframeBox = (
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
): THREE.LineSegments | null => {
  const wireframeGeometry = new THREE.BoxGeometry(
    worldXDim,
    worldZDim,
    worldYDim
  );
  const edges = new THREE.EdgesGeometry(wireframeGeometry);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0x606060,
    transparent: false,
  });
  const wireframeBox = new THREE.LineSegments(edges, wireframeMaterial);
  wireframeBox.position.set(worldXDim / 2, worldZDim / 2, worldYDim / 2);
  wireframeBox.layers.set(layers.ghost);
  wireframeGeometry.dispose();
  return wireframeBox;
};

const LINE_WIDTHS = [0.01, 0.02, 0.04, 0.08];
const LINE_THICKNESS = 0.001;
const LINE_OFFSET = 0.001;

function getLineWidthForGrid(index: number, worldDim: number): number {
  const offsetIndex = Math.round(index - worldDim / 2);
  if (offsetIndex % 20 === 0) return LINE_WIDTHS[3];
  if (offsetIndex % 4 === 0) return LINE_WIDTHS[2];
  if (offsetIndex % 2 === 0) return LINE_WIDTHS[1];
  return LINE_WIDTHS[0];
}

function createFaceGridLines(
  face: "bottom" | "top" | "front" | "back" | "left" | "right",
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
): BoundsFace | null {
  const geometries: THREE.BufferGeometry[] = [];
  let center: THREE.Vector3;
  let inwardNormal: THREE.Vector3;

  switch (face) {
    case "bottom": {
      center = new THREE.Vector3(worldXDim / 2, 0, worldYDim / 2);
      inwardNormal = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i <= worldXDim; i++) {
        const w = getLineWidthForGrid(i, worldXDim);
        const g = new THREE.BoxGeometry(w, LINE_THICKNESS, worldYDim);
        g.translate(i, LINE_OFFSET, worldYDim / 2);
        geometries.push(g);
      }
      for (let i = 0; i <= worldYDim; i++) {
        const w = getLineWidthForGrid(i, worldYDim);
        const g = new THREE.BoxGeometry(worldXDim, LINE_THICKNESS, w);
        g.translate(worldXDim / 2, LINE_OFFSET, i);
        geometries.push(g);
      }
      break;
    }
    case "top": {
      center = new THREE.Vector3(worldXDim / 2, worldZDim, worldYDim / 2);
      inwardNormal = new THREE.Vector3(0, -1, 0);
      for (let i = 0; i <= worldXDim; i++) {
        const w = getLineWidthForGrid(i, worldXDim);
        const g = new THREE.BoxGeometry(w, LINE_THICKNESS, worldYDim);
        g.translate(i, worldZDim - LINE_OFFSET, worldYDim / 2);
        geometries.push(g);
      }
      for (let i = 0; i <= worldYDim; i++) {
        const w = getLineWidthForGrid(i, worldYDim);
        const g = new THREE.BoxGeometry(worldXDim, LINE_THICKNESS, w);
        g.translate(worldXDim / 2, worldZDim - LINE_OFFSET, i);
        geometries.push(g);
      }
      break;
    }
    case "front": {
      center = new THREE.Vector3(worldXDim / 2, worldZDim / 2, 0);
      inwardNormal = new THREE.Vector3(0, 0, 1);
      for (let i = 0; i <= worldXDim; i++) {
        const w = getLineWidthForGrid(i, worldXDim);
        const g = new THREE.BoxGeometry(w, worldZDim, LINE_THICKNESS);
        g.translate(i, worldZDim / 2, LINE_OFFSET);
        geometries.push(g);
      }
      for (let i = 0; i <= worldZDim; i++) {
        const w = getLineWidthForGrid(i, worldZDim);
        const g = new THREE.BoxGeometry(worldXDim, w, LINE_THICKNESS);
        g.translate(worldXDim / 2, i, LINE_OFFSET);
        geometries.push(g);
      }
      break;
    }
    case "back": {
      center = new THREE.Vector3(worldXDim / 2, worldZDim / 2, worldYDim);
      inwardNormal = new THREE.Vector3(0, 0, -1);
      for (let i = 0; i <= worldXDim; i++) {
        const w = getLineWidthForGrid(i, worldXDim);
        const g = new THREE.BoxGeometry(w, worldZDim, LINE_THICKNESS);
        g.translate(i, worldZDim / 2, worldYDim - LINE_OFFSET);
        geometries.push(g);
      }
      for (let i = 0; i <= worldZDim; i++) {
        const w = getLineWidthForGrid(i, worldZDim);
        const g = new THREE.BoxGeometry(worldXDim, w, LINE_THICKNESS);
        g.translate(worldXDim / 2, i, worldYDim - LINE_OFFSET);
        geometries.push(g);
      }
      break;
    }
    case "left": {
      center = new THREE.Vector3(0, worldZDim / 2, worldYDim / 2);
      inwardNormal = new THREE.Vector3(1, 0, 0);
      for (let i = 0; i <= worldYDim; i++) {
        const w = getLineWidthForGrid(i, worldYDim);
        const g = new THREE.BoxGeometry(LINE_THICKNESS, worldZDim, w);
        g.translate(LINE_OFFSET, worldZDim / 2, i);
        geometries.push(g);
      }
      for (let i = 0; i <= worldZDim; i++) {
        const w = getLineWidthForGrid(i, worldZDim);
        const g = new THREE.BoxGeometry(LINE_THICKNESS, w, worldYDim);
        g.translate(LINE_OFFSET, i, worldYDim / 2);
        geometries.push(g);
      }
      break;
    }
    case "right": {
      center = new THREE.Vector3(worldXDim, worldZDim / 2, worldYDim / 2);
      inwardNormal = new THREE.Vector3(-1, 0, 0);
      for (let i = 0; i <= worldYDim; i++) {
        const w = getLineWidthForGrid(i, worldYDim);
        const g = new THREE.BoxGeometry(LINE_THICKNESS, worldZDim, w);
        g.translate(worldXDim - LINE_OFFSET, worldZDim / 2, i);
        geometries.push(g);
      }
      for (let i = 0; i <= worldZDim; i++) {
        const w = getLineWidthForGrid(i, worldZDim);
        const g = new THREE.BoxGeometry(LINE_THICKNESS, w, worldYDim);
        g.translate(worldXDim - LINE_OFFSET, i, worldYDim / 2);
        geometries.push(g);
      }
      break;
    }
  }

  if (geometries.length === 0) return null;

  const merged = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  if (!merged) return null;

  const material = new THREE.MeshBasicMaterial({
    color: 0x444444,
    transparent: true,
  });
  const mesh = new THREE.Mesh(merged, material);
  mesh.layers.set(layers.ghost);
  return { mesh, center, inwardNormal };
}