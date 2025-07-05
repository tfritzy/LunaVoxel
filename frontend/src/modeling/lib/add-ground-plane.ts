import * as THREE from "three";
import { layers } from "./layers";

export const addGroundPlane = (
  scene: THREE.Scene,
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
) => {
  const invisibleBoxGeometry = new THREE.BoxGeometry(
    worldXDim,
    worldZDim,
    worldYDim
  );
  const index = invisibleBoxGeometry.index;
  if (index) {
    const indexArray = index.array;
    for (let i = 0; i < indexArray.length; i += 3) {
      const temp = indexArray[i + 1];
      indexArray[i + 1] = indexArray[i + 2];
      indexArray[i + 2] = temp;
    }
    index.needsUpdate = true;
  }
  const invisibleBoxMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.FrontSide,
  });
  const invisibleBox = new THREE.Mesh(
    invisibleBoxGeometry,
    invisibleBoxMaterial
  );
  invisibleBox.position.set(worldXDim / 2, worldZDim / 2, worldYDim / 2);
  invisibleBox.layers.set(layers.raycast);
  invisibleBox.userData.isBoundaryBox = true;
  scene.add(invisibleBox);

  const wireframeBox = createWireframeBox(worldXDim, worldYDim, worldZDim);
  if (wireframeBox) {
    scene.add(wireframeBox);
  }

  // const gridLines = createOptimizedGridLines(worldXDim, worldYDim);
  // if (gridLines) {
  //   scene.add(gridLines);
  // }

  const axisArrows = createAxisArrows(worldXDim, worldYDim);
  if (axisArrows) {
    scene.add(axisArrows);
  }

  return {
    invisibleBox,
    wireframeBox,
    axisArrows,
  };
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

const createOptimizedGridLines = (
  worldXDim: number,
  worldYDim: number
): THREE.LineSegments | null => {
  const positions: number[] = [];
  const colors: number[] = [];
  const lineYPosition = 0.001;

  const lightColor = new THREE.Color(0x333333);
  const mediumColor = new THREE.Color(0x444444);
  const heavyColor = new THREE.Color(0x555555);
  const majorColor = new THREE.Color(0x666666);

  const getLineColor = (index: number): THREE.Color => {
    if (index % 20 === 0) return majorColor;
    if (index % 4 === 0) return heavyColor;
    if (index % 2 === 0) return mediumColor;
    return lightColor;
  };

  for (let i = 0; i <= worldXDim; i++) {
    const color = getLineColor(i);

    positions.push(i, lineYPosition, 0);
    colors.push(color.r, color.g, color.b);

    positions.push(i, lineYPosition, worldYDim);
    colors.push(color.r, color.g, color.b);
  }

  for (let i = 0; i <= worldYDim; i++) {
    const color = getLineColor(i);

    positions.push(0, lineYPosition, i);
    colors.push(color.r, color.g, color.b);

    positions.push(worldXDim, lineYPosition, i);
    colors.push(color.r, color.g, color.b);
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });

  const gridLines = new THREE.LineSegments(geometry, material);
  gridLines.layers.set(layers.ghost);

  return gridLines;
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
