import * as THREE from "three";
import { layers } from "./layers";

export function addGroundPlane(scene: THREE.Scene) {
  const gridSize = 80;
  const groundGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
  const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0x333333,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = Math.PI / 2;
  groundPlane.position.y = 0;
  scene.add(groundPlane);
  groundPlane.layers.set(layers.blocks);

  const gridGroup = new THREE.Group();
  scene.add(gridGroup);

  createBatchedGrid(gridSize, gridGroup);

  return { groundMaterial, groundGeometry, groundPlane };
}

function createBatchedGrid(gridSize: number, gridGroup: THREE.Group) {
  const cellSize = 1;
  const halfGrid = gridSize / 2;
  const offset = halfGrid % 20;

  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x333333,
    transparent: true,
  });

  const lineWidths = [0.005, 0.01, 0.03, 0.05];

  const hLineGeometries = lineWidths.map(
    (width) => new THREE.BoxGeometry(gridSize, 0.001, width)
  );

  const vLineGeometries = lineWidths.map(
    (width) => new THREE.BoxGeometry(width, 0.001, gridSize)
  );

  const instanceCounts = [0, 0, 0, 0];

  for (let i = 0; i <= gridSize; i++) {
    let typeIndex;
    const index = i + offset;
    if (index % 20 === 0) {
      typeIndex = 3;
    } else if (index % 4 === 0) {
      typeIndex = 2;
    } else if (index % 2 === 0) {
      typeIndex = 1;
    } else {
      typeIndex = 0;
    }

    instanceCounts[typeIndex]++;
  }

  const hInstances = instanceCounts.map(
    (count, i) =>
      new THREE.InstancedMesh(hLineGeometries[i], lineMaterial, count)
  );

  const vInstances = instanceCounts.map(
    (count, i) =>
      new THREE.InstancedMesh(vLineGeometries[i], lineMaterial, count)
  );

  const instanceIndices = [0, 0, 0, 0];

  for (let i = 0; i <= gridSize; i++) {
    const pos = -halfGrid + i * cellSize + 0.5;

    let typeIndex;
    const index = i + offset;
    if (index % 20 === 0) {
      typeIndex = 3;
    } else if (index % 4 === 0) {
      typeIndex = 2;
    } else if (index % 2 === 0) {
      typeIndex = 1;
    } else {
      typeIndex = 0;
    }

    const hMatrix = new THREE.Matrix4().setPosition(0, 0, pos);
    hInstances[typeIndex].setMatrixAt(instanceIndices[typeIndex], hMatrix);

    const vMatrix = new THREE.Matrix4().setPosition(pos, 0, 0);
    vInstances[typeIndex].setMatrixAt(instanceIndices[typeIndex], vMatrix);

    instanceIndices[typeIndex]++;
  }

  hInstances.forEach((mesh) => gridGroup.add(mesh));
  vInstances.forEach((mesh) => gridGroup.add(mesh));

  return gridGroup;
}
