import * as THREE from "three";
import { layers } from "./layers";

export function addGroundPlane(
  scene: THREE.Scene,
  worldWidth: number,
  worldHeight: number
) {
  const groundGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
  const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0x555555,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = Math.PI / 2;
  groundPlane.position.y = 0;

  groundPlane.position.x = worldWidth / 2 - 0.5;
  groundPlane.position.z = worldHeight / 2 - 0.5;

  groundPlane.receiveShadow = true;
  scene.add(groundPlane);
  groundPlane.layers.set(layers.raycast);

  const gridGroup = new THREE.Group();
  scene.add(gridGroup);

  createBatchedGrid(worldWidth, worldHeight, gridGroup);

  return { groundMaterial, groundGeometry, groundPlane };
}

function createBatchedGrid(
  width: number,
  height: number,
  gridGroup: THREE.Group
) {
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    transparent: true,
    opacity: 0.5,
  });

  const lineWidths = [0.005, 0.01, 0.03, 0.05];

  for (let i = 0; i <= width; i++) {
    const lineWidth = getLineWidth(i);

    const hLineGeometry = new THREE.BoxGeometry(lineWidth, 0.001, height);
    const hLine = new THREE.Mesh(hLineGeometry, lineMaterial);

    hLine.position.set(i - 0.5, 0.001, height / 2 - 0.5);
    hLine.layers.set(layers.ghost);
    gridGroup.add(hLine);
  }

  for (let i = 0; i <= height; i++) {
    const lineWidth = getLineWidth(i);

    const vLineGeometry = new THREE.BoxGeometry(width, 0.001, lineWidth);
    const vLine = new THREE.Mesh(vLineGeometry, lineMaterial);

    vLine.position.set(width / 2 - 0.5, 0.001, i - 0.5);
    vLine.layers.set(layers.ghost);
    gridGroup.add(vLine);
  }

  function getLineWidth(index: number): number {
    if (index % 20 === 0) {
      return lineWidths[3];
    } else if (index % 4 === 0) {
      return lineWidths[2];
    } else if (index % 2 === 0) {
      return lineWidths[1];
    } else {
      return lineWidths[0];
    }
  }

  return gridGroup;
}
