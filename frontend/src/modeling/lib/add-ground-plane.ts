import * as THREE from "three";
import { layers } from "./layers";

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

  const gridLines = createOptimizedGridLines(worldXDim, worldYDim);
  if (gridLines) {
    scene.add(gridLines);
  }

  // const axisArrows = createOptimizedAxisArrows(
  //   scene,
  //   worldXDim,
  //   worldYDim,
  //   worldZDim
  // );

  return {
    invisibleBox,
    wireframeBox,
    axisArrows: undefined,
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

function createOptimizedGridLines(
  worldXDim: number,
  worldYDim: number
): THREE.LineSegments | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const lineYPosition = 0.001;

  // Color definitions for different line weights
  const lightColor = new THREE.Color(0x333333);
  const mediumColor = new THREE.Color(0x444444);
  const heavyColor = new THREE.Color(0x555555);
  const majorColor = new THREE.Color(0x666666);

  function getLineColor(index: number): THREE.Color {
    if (index % 20 === 0) return majorColor;
    if (index % 4 === 0) return heavyColor;
    if (index % 2 === 0) return mediumColor;
    return lightColor;
  }

  // Vertical grid lines (parallel to Z-axis)
  for (let i = 0; i <= worldXDim; i++) {
    const color = getLineColor(i);

    // Start point
    positions.push(i, lineYPosition, 0);
    colors.push(color.r, color.g, color.b);

    // End point
    positions.push(i, lineYPosition, worldYDim);
    colors.push(color.r, color.g, color.b);
  }

  // Horizontal grid lines (parallel to X-axis)
  for (let i = 0; i <= worldYDim; i++) {
    const color = getLineColor(i);

    // Start point
    positions.push(0, lineYPosition, i);
    colors.push(color.r, color.g, color.b);

    // End point
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
}
