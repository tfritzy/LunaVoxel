import * as THREE from "three";
import { layers } from "./layers";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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

  const gridLines = createBatchedGridLines(worldXDim, worldYDim);
  if (gridLines) {
    scene.add(gridLines);
  }

  return {
    boundaryPlanes,
    wireframeBox,
    gridLines,
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

function createBatchedGridLines(
  worldXDim: number,
  worldYDim: number
): THREE.Mesh | null {
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    transparent: true,
  });

  const lineWidths = [0.01, 0.02, 0.04, 0.08];
  const geometries: THREE.BufferGeometry[] = [];
  const lineThickness = 0.001;
  const lineYPosition = 0.001;

  function getLineWidthForGrid(index: number, worldDim: number): number {
    const center = worldDim / 2;
    const offsetIndex = Math.round(index - center);

    if (offsetIndex % 20 === 0) return lineWidths[3];
    if (offsetIndex % 4 === 0) return lineWidths[2];
    if (offsetIndex % 2 === 0) return lineWidths[1];
    return lineWidths[0];
  }

  for (let i = 0; i <= worldXDim; i++) {
    const dynamicLineWidth = getLineWidthForGrid(i, worldXDim);
    const vLineGeom = new THREE.BoxGeometry(
      dynamicLineWidth,
      lineThickness,
      worldYDim
    );
    vLineGeom.translate(i, lineYPosition, worldYDim / 2);
    geometries.push(vLineGeom);
  }

  for (let i = 0; i <= worldYDim; i++) {
    const dynamicLineWidth = getLineWidthForGrid(i, worldYDim);
    const hLineGeom = new THREE.BoxGeometry(
      worldXDim,
      lineThickness,
      dynamicLineWidth
    );
    hLineGeom.translate(worldXDim / 2, lineYPosition, i);
    geometries.push(hLineGeom);
  }

  if (geometries.length === 0) {
    return null;
  }

  const mergedGeometry = mergeGeometries(geometries);
  geometries.forEach((geom) => geom.dispose());

  if (!mergedGeometry) {
    return null;
  }

  const batchedGridMesh = new THREE.Mesh(mergedGeometry, lineMaterial);
  batchedGridMesh.layers.set(layers.ghost);

  return batchedGridMesh;
}