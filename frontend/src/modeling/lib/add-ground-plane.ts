import * as THREE from "three";
import { layers } from "./layers";

export const addGroundPlane = (
  scene: THREE.Scene,
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
) => {
  const raycastMultiplier = 100;
  const raycastXDim = worldXDim * raycastMultiplier;
  const raycastYDim = worldYDim * raycastMultiplier;
  const raycastZDim = worldZDim * raycastMultiplier;

  const boundaryPlanes = createBoundaryPlanes(raycastXDim, raycastYDim, raycastZDim);
  boundaryPlanes.forEach(plane => {
    scene.add(plane);
  });

  const wireframeBox = createWireframeBox(worldXDim, worldYDim, worldZDim);
  if (wireframeBox) {
    scene.add(wireframeBox);
  }

  const axisArrows = createAxisArrows(worldXDim, worldYDim);
  if (axisArrows) {
    scene.add(axisArrows);
  }

  const gridLines = createGridLines(worldXDim, worldYDim);
  if (gridLines) {
    scene.add(gridLines);
  }

  return {
    boundaryPlanes,
    wireframeBox,
    axisArrows,
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

  const worldXDim = raycastXDim / 100;
  const worldYDim = raycastYDim / 100;
  const worldZDim = raycastZDim / 100;

  const frontGeometry = new THREE.PlaneGeometry(raycastXDim, raycastZDim);
  const frontPlane = new THREE.Mesh(frontGeometry, material.clone());
  frontPlane.rotation.y = 2 * Math.PI;
  frontPlane.position.set(worldXDim / 2, worldZDim / 2, 0);
  frontPlane.layers.set(layers.raycast);
  frontPlane.userData.isBoundaryPlane = true;
  frontPlane.userData.side = 'front';
  planes.push(frontPlane);

  const backGeometry = new THREE.PlaneGeometry(raycastXDim, raycastZDim);
  const backPlane = new THREE.Mesh(backGeometry, material.clone());
  backPlane.rotation.y = -Math.PI;
  backPlane.position.set(worldXDim / 2, worldZDim / 2, worldYDim);
  backPlane.layers.set(layers.raycast);
  backPlane.userData.isBoundaryPlane = true;
  backPlane.userData.side = 'back';
  planes.push(backPlane);

  const leftGeometry = new THREE.PlaneGeometry(raycastYDim, raycastZDim);
  const leftPlane = new THREE.Mesh(leftGeometry, material.clone());
  leftPlane.rotation.y = Math.PI / 2;
  leftPlane.position.set(0, worldZDim / 2, worldYDim / 2);
  leftPlane.layers.set(layers.raycast);
  leftPlane.userData.isBoundaryPlane = true;
  leftPlane.userData.side = 'left';
  planes.push(leftPlane);

  const rightGeometry = new THREE.PlaneGeometry(raycastYDim, raycastZDim);
  const rightPlane = new THREE.Mesh(rightGeometry, material.clone());
  rightPlane.rotation.y = -Math.PI / 2;
  rightPlane.position.set(worldXDim, worldZDim / 2, worldYDim / 2);
  rightPlane.layers.set(layers.raycast);
  rightPlane.userData.isBoundaryPlane = true;
  rightPlane.userData.side = 'right';
  planes.push(rightPlane);

  const bottomGeometry = new THREE.PlaneGeometry(raycastXDim, raycastYDim);
  const bottomPlane = new THREE.Mesh(bottomGeometry, material.clone());
  bottomPlane.rotation.x = -Math.PI / 2;
  bottomPlane.position.set(worldXDim / 2, .000001, worldYDim / 2);
  bottomPlane.layers.set(layers.raycast);
  bottomPlane.userData.isBoundaryPlane = true;
  bottomPlane.userData.side = 'bottom';
  planes.push(bottomPlane);

  const topGeometry = new THREE.PlaneGeometry(raycastXDim, raycastYDim);
  const topPlane = new THREE.Mesh(topGeometry, material.clone());
  topPlane.rotation.x = Math.PI / 2;
  topPlane.position.set(worldXDim / 2, worldZDim - .000001, worldYDim / 2);
  topPlane.layers.set(layers.raycast);
  topPlane.userData.isBoundaryPlane = true;
  topPlane.userData.side = 'top';
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
    color: 0x363636,
    transparent: false,
  });
  const wireframeBox = new THREE.LineSegments(edges, wireframeMaterial);
  wireframeBox.position.set(worldXDim / 2, worldZDim / 2, worldYDim / 2);
  wireframeBox.layers.set(layers.ghost);
  wireframeGeometry.dispose();
  return wireframeBox;
};

const createAxisArrows = (
  worldXDim: number,
  worldYDim: number
): THREE.Group | null => {
  const arrowLength = Math.max(1, Math.min(worldXDim, worldYDim) * 0.1);
  const arrowHeadLength = arrowLength * 0.2;
  const arrowHeadWidth = arrowLength * 0.1;
  const shaftRadius = arrowLength * 0.02;
  const arrowYPosition = 0.01;

  const arrowGroup = new THREE.Group();

  const createArrow = (
    color: number,
    direction: THREE.Vector3
  ): THREE.Group => {
    const arrow = new THREE.Group();

    const shaftGeometry = new THREE.CylinderGeometry(
      shaftRadius,
      shaftRadius,
      arrowLength - arrowHeadLength,
      8
    );
    const shaftMaterial = new THREE.MeshBasicMaterial({ color });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.position.copy(
      direction.clone().multiplyScalar((arrowLength - arrowHeadLength) / 2)
    );

    const headGeometry = new THREE.ConeGeometry(
      arrowHeadWidth,
      arrowHeadLength,
      8
    );
    const headMaterial = new THREE.MeshBasicMaterial({ color });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.copy(
      direction.clone().multiplyScalar(arrowLength - arrowHeadLength / 2)
    );

    if (direction.x !== 0) {
      shaft.rotation.z = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
      head.rotation.z = direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else if (direction.z !== 0) {
      shaft.rotation.x = direction.z > 0 ? Math.PI / 2 : -Math.PI / 2;
      head.rotation.x = direction.z > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    arrow.add(shaft);
    arrow.add(head);
    arrow.layers.set(layers.ghost);

    return arrow;
  };

  const xArrow = createArrow(0xff0000, new THREE.Vector3(1, 0, 0));
  xArrow.position.set(0, arrowYPosition, 0);

  const zArrow = createArrow(0x0000ff, new THREE.Vector3(0, 0, 1));
  zArrow.position.set(0, arrowYPosition, 0);

  arrowGroup.add(xArrow);
  arrowGroup.add(zArrow);

  return arrowGroup;
};

const createGridLines = (
  worldXDim: number,
  worldYDim: number
): THREE.LineSegments | null => {
  const gridGeometry = new THREE.BufferGeometry();
  const vertices: number[] = [];

  for (let x = 0; x <= worldXDim; x += 1) {
    vertices.push(x, 0, 0);
    vertices.push(x, 0, worldYDim);
  }

  for (let z = 0; z <= worldYDim; z += 1) {
    vertices.push(0, 0, z);
    vertices.push(worldXDim, 0, z);
  }

  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x444444,
    transparent: true,
    opacity: 0.3
  });

  const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
  gridLines.position.set(0, 0.001, 0);
  gridLines.layers.set(layers.ghost);

  return gridLines;
};