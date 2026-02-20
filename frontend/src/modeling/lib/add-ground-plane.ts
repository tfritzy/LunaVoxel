import * as THREE from "three";
import { layers } from "./layers";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type BoundsEdge = {
  mesh: THREE.Mesh;
  face0Center: THREE.Vector3;
  face0Normal: THREE.Vector3;
  face1Center: THREE.Vector3;
  face1Normal: THREE.Vector3;
};

const _v = new THREE.Vector3();

export function updateBoundsVisibility(
  cameraPos: THREE.Vector3,
  edges: BoundsEdge[]
): void {
  for (const edge of edges) {
    const vis0 =
      edge.face0Normal.dot(_v.subVectors(cameraPos, edge.face0Center)) > 0;
    const vis1 =
      edge.face1Normal.dot(_v.subVectors(cameraPos, edge.face1Center)) > 0;
    edge.mesh.visible = vis0 && vis1;
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

  const gridLines = createBatchedGridLines(worldXDim, worldYDim);
  if (gridLines) {
    scene.add(gridLines);
  }

  const boundsEdges = createBoundsEdges(worldXDim, worldYDim, worldZDim);
  boundsEdges.forEach((edge) => scene.add(edge.mesh));

  return {
    boundaryPlanes,
    gridLines,
    boundsEdges,
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

const LINE_WIDTHS = [0.01, 0.02, 0.04, 0.08];
const LINE_THICKNESS = 0.001;
const LINE_OFFSET = 0.001;
const EDGE_THICKNESS = 0.05;

function getLineWidthForGrid(index: number, worldDim: number): number {
  const offsetIndex = Math.round(index - worldDim / 2);
  if (offsetIndex % 20 === 0) return LINE_WIDTHS[3];
  if (offsetIndex % 4 === 0) return LINE_WIDTHS[2];
  if (offsetIndex % 2 === 0) return LINE_WIDTHS[1];
  return LINE_WIDTHS[0];
}

function createBatchedGridLines(
  worldXDim: number,
  worldYDim: number
): THREE.Mesh | null {
  const geometries: THREE.BufferGeometry[] = [];

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

  if (geometries.length === 0) return null;

  const merged = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  if (!merged) return null;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true })
  );
  mesh.layers.set(layers.ghost);
  return mesh;
}

function createBoundsEdges(
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
): BoundsEdge[] {
  const t = EDGE_THICKNESS;
  const material = new THREE.MeshBasicMaterial({ color: 0x606060 });

  const faceBottom = {
    center: new THREE.Vector3(worldXDim / 2, 0, worldYDim / 2),
    normal: new THREE.Vector3(0, 1, 0),
  };
  const faceTop = {
    center: new THREE.Vector3(worldXDim / 2, worldZDim, worldYDim / 2),
    normal: new THREE.Vector3(0, -1, 0),
  };
  const faceFront = {
    center: new THREE.Vector3(worldXDim / 2, worldZDim / 2, 0),
    normal: new THREE.Vector3(0, 0, 1),
  };
  const faceBack = {
    center: new THREE.Vector3(worldXDim / 2, worldZDim / 2, worldYDim),
    normal: new THREE.Vector3(0, 0, -1),
  };
  const faceLeft = {
    center: new THREE.Vector3(0, worldZDim / 2, worldYDim / 2),
    normal: new THREE.Vector3(1, 0, 0),
  };
  const faceRight = {
    center: new THREE.Vector3(worldXDim, worldZDim / 2, worldYDim / 2),
    normal: new THREE.Vector3(-1, 0, 0),
  };

  type FaceDef = { center: THREE.Vector3; normal: THREE.Vector3 };
  const edges: BoundsEdge[] = [];

  const addEdge = (
    geom: THREE.BoxGeometry,
    cx: number,
    cy: number,
    cz: number,
    f0: FaceDef,
    f1: FaceDef
  ) => {
    geom.translate(cx, cy, cz);
    const mesh = new THREE.Mesh(geom, material);
    mesh.layers.set(layers.ghost);
    edges.push({
      mesh,
      face0Center: f0.center,
      face0Normal: f0.normal,
      face1Center: f1.center,
      face1Normal: f1.normal,
    });
  };

  // Bottom 4 edges (y = 0)
  addEdge(new THREE.BoxGeometry(worldXDim, t, t), worldXDim / 2, 0, 0, faceBottom, faceFront);
  addEdge(new THREE.BoxGeometry(t, t, worldYDim), worldXDim, 0, worldYDim / 2, faceBottom, faceRight);
  addEdge(new THREE.BoxGeometry(worldXDim, t, t), worldXDim / 2, 0, worldYDim, faceBottom, faceBack);
  addEdge(new THREE.BoxGeometry(t, t, worldYDim), 0, 0, worldYDim / 2, faceBottom, faceLeft);

  // Top 4 edges (y = worldZDim)
  addEdge(new THREE.BoxGeometry(worldXDim, t, t), worldXDim / 2, worldZDim, 0, faceTop, faceFront);
  addEdge(new THREE.BoxGeometry(t, t, worldYDim), worldXDim, worldZDim, worldYDim / 2, faceTop, faceRight);
  addEdge(new THREE.BoxGeometry(worldXDim, t, t), worldXDim / 2, worldZDim, worldYDim, faceTop, faceBack);
  addEdge(new THREE.BoxGeometry(t, t, worldYDim), 0, worldZDim, worldYDim / 2, faceTop, faceLeft);

  // Vertical 4 edges
  addEdge(new THREE.BoxGeometry(t, worldZDim, t), 0, worldZDim / 2, 0, faceFront, faceLeft);
  addEdge(new THREE.BoxGeometry(t, worldZDim, t), worldXDim, worldZDim / 2, 0, faceFront, faceRight);
  addEdge(new THREE.BoxGeometry(t, worldZDim, t), worldXDim, worldZDim / 2, worldYDim, faceBack, faceRight);
  addEdge(new THREE.BoxGeometry(t, worldZDim, t), 0, worldZDim / 2, worldYDim, faceBack, faceLeft);

  return edges;
}