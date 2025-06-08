import * as THREE from "three";
import { layers } from "./layers";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function addGroundPlane(
  scene: THREE.Scene,
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
) {
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

  const batchedGridMesh = createBatchedGridLines(worldXDim, worldYDim);
  if (batchedGridMesh) {
    scene.add(batchedGridMesh);
  }

  return {
    invisibleBox,
    wireframeBox,
  };
}

function createWireframeBox(
  worldXDim: number,
  worldYDim: number,
  worldZDim: number
): THREE.LineSegments | null {
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
}

function createBatchedGridLines(
  worldXDim: number,
  worldYDim: number
): THREE.Mesh | null {
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    transparent: true,
  });

  const lineWidths = [0.01, 0.02, 0.04, 0.06];
  const geometries: THREE.BufferGeometry[] = [];
  const lineThickness = 0.001;
  const lineYPosition = 0.001; // Grid lines at Y = 0 + small offset

  function getLineWidthForGrid(index: number): number {
    if (index % 20 === 0) return lineWidths[3];
    if (index % 4 === 0) return lineWidths[2];
    if (index % 2 === 0) return lineWidths[1];
    return lineWidths[0];
  }

  for (let i = 0; i <= worldXDim; i++) {
    const dynamicLineWidth = getLineWidthForGrid(i);
    const vLineGeom = new THREE.BoxGeometry(
      dynamicLineWidth,
      lineThickness,
      worldYDim
    );
    // Vertical grid lines from X=0 to X=worldXDim, positioned at Z center
    vLineGeom.translate(i, lineYPosition, worldYDim / 2);
    geometries.push(vLineGeom);
  }

  for (let i = 0; i <= worldYDim; i++) {
    const dynamicLineWidth = getLineWidthForGrid(i);
    const hLineGeom = new THREE.BoxGeometry(
      worldXDim,
      lineThickness,
      dynamicLineWidth
    );
    // Grid lines from 0 to worldZDim, positioned at X center
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
