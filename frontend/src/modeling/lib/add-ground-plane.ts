import * as THREE from "three";
import { layers } from "./layers";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function addGroundPlane(
  scene: THREE.Scene,
  worldWidth: number,
  worldHeight: number
) {
  const borderExtension = 0.06;
  const borderGeometry = new THREE.PlaneGeometry(
    worldWidth + borderExtension * 2,
    worldHeight + borderExtension * 2
  );
  const borderMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    side: THREE.DoubleSide,
  });
  const borderPlane = new THREE.Mesh(borderGeometry, borderMaterial);
  borderPlane.rotation.x = Math.PI / 2;
  borderPlane.position.y = -0.01;
  borderPlane.receiveShadow = true;
  scene.add(borderPlane);

  const groundGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
  const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0x333333,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = Math.PI / 2;
  groundPlane.position.y = 0.0001;
  groundPlane.receiveShadow = true;
  scene.add(groundPlane);
  groundPlane.layers.set(layers.raycast);

  const batchedGridMesh = createBatchedGridLines(worldWidth, worldHeight);
  if (batchedGridMesh) {
    scene.add(batchedGridMesh);
  }

  return { groundMaterial, groundGeometry, groundPlane };
}

function createBatchedGridLines(
  worldWidth: number,
  worldHeight: number
): THREE.Mesh | null {
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    transparent: true,
  });

  const lineWidths = [0.01, 0.02, 0.04, 0.06];
  const geometries: THREE.BufferGeometry[] = [];
  const lineThickness = 0.001;
  const lineYPosition = 0.001;

  function getLineWidthForGrid(index: number): number {
    if (index % 20 === 0) return lineWidths[3];
    if (index % 4 === 0) return lineWidths[2];
    if (index % 2 === 0) return lineWidths[1];
    return lineWidths[0];
  }

  for (let i = -worldWidth / 2; i <= worldWidth / 2; i++) {
    const dynamicLineWidth = getLineWidthForGrid(i);
    const hLineGeom = new THREE.BoxGeometry(
      dynamicLineWidth,
      lineThickness,
      worldHeight
    );
    hLineGeom.translate(i, lineYPosition, 0);
    geometries.push(hLineGeom);
  }

  for (let i = -worldHeight / 2; i <= worldHeight / 2; i++) {
    const dynamicLineWidth = getLineWidthForGrid(i);
    const vLineGeom = new THREE.BoxGeometry(
      worldWidth,
      lineThickness,
      dynamicLineWidth
    );
    vLineGeom.translate(0, lineYPosition, i);
    geometries.push(vLineGeom);
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
