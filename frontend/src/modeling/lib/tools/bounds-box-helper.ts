import * as THREE from "three";

export function createBoundsLineSegments(color: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(72), 3)
  );
  const ls = new THREE.LineSegments(
    geometry,
    new THREE.LineDashedMaterial({
      color,
      dashSize: 0.3,
      gapSize: 0.15,
      depthTest: false,
      depthWrite: false,
    })
  );
  ls.renderOrder = 999;
  return ls;
}

export function updateBoundsLineSegments(
  ls: THREE.LineSegments,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number
): void {
  const pos = (ls.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
  // Bottom face
  pos[ 0] = minX; pos[ 1] = minY; pos[ 2] = minZ; pos[ 3] = maxX; pos[ 4] = minY; pos[ 5] = minZ;
  pos[ 6] = maxX; pos[ 7] = minY; pos[ 8] = minZ; pos[ 9] = maxX; pos[10] = minY; pos[11] = maxZ;
  pos[12] = maxX; pos[13] = minY; pos[14] = maxZ; pos[15] = minX; pos[16] = minY; pos[17] = maxZ;
  pos[18] = minX; pos[19] = minY; pos[20] = maxZ; pos[21] = minX; pos[22] = minY; pos[23] = minZ;
  // Top face
  pos[24] = minX; pos[25] = maxY; pos[26] = minZ; pos[27] = maxX; pos[28] = maxY; pos[29] = minZ;
  pos[30] = maxX; pos[31] = maxY; pos[32] = minZ; pos[33] = maxX; pos[34] = maxY; pos[35] = maxZ;
  pos[36] = maxX; pos[37] = maxY; pos[38] = maxZ; pos[39] = minX; pos[40] = maxY; pos[41] = maxZ;
  pos[42] = minX; pos[43] = maxY; pos[44] = maxZ; pos[45] = minX; pos[46] = maxY; pos[47] = minZ;
  // Vertical edges
  pos[48] = minX; pos[49] = minY; pos[50] = minZ; pos[51] = minX; pos[52] = maxY; pos[53] = minZ;
  pos[54] = maxX; pos[55] = minY; pos[56] = minZ; pos[57] = maxX; pos[58] = maxY; pos[59] = minZ;
  pos[60] = maxX; pos[61] = minY; pos[62] = maxZ; pos[63] = maxX; pos[64] = maxY; pos[65] = maxZ;
  pos[66] = minX; pos[67] = minY; pos[68] = maxZ; pos[69] = minX; pos[70] = maxY; pos[71] = maxZ;
  (ls.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  ls.computeLineDistances();
}
