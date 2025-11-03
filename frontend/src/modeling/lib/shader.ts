import * as THREE from "three";

const vertexShader = `
attribute float aochannel;
attribute float isSelected;
varying vec2 vUv;
varying vec3 vNormal;
varying float vAO;
varying float vIsSelected;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vAO = aochannel;
  vIsSelected = isSelected;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
 
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D map;
uniform float opacity;
uniform bool showGrid;
varying vec2 vUv;
varying vec3 vNormal;
varying float vAO;
varying float vIsSelected;
varying vec3 vWorldPosition;

void main() {
  vec4 textureColor = texture2D(map, vUv);
 
  vec3 normal = normalize(vNormal);
 
  float darknessFactor = 1.0;
 
  if (abs(normal.y - 1.0) < 0.1) {
    darknessFactor = .95;
  } else if (abs(normal.y + 1.0) < 0.1) {
    darknessFactor = 0.6;
  } else if (abs(normal.x) > 0.9) {
    darknessFactor = 0.9;
  } else if (abs(normal.z) > 0.9) {
    darknessFactor = 0.8;
  }
 
  vec3 finalColor = textureColor.rgb * darknessFactor * vAO;
  
  // Apply selection grid effect if this face is selected
  if (vIsSelected > 0.5) {
    float lineWidth = 0.025;
    vec3 gridPos = fract(vWorldPosition);
    
    float gridLine = 0.0;
    
    if (gridPos.x > 0.0 && gridPos.x < 1.0) {
      if (gridPos.x < lineWidth || gridPos.x > 1.0 - lineWidth) {
        gridLine = 1.0;
      }
    }
    if (gridPos.y > 0.0 && gridPos.y < 1.0){
      if (gridPos.y < lineWidth || gridPos.y > 1.0 - lineWidth) {
        gridLine = 1.0;
      }
    }
    if (gridPos.z > 0.0 && gridPos.z < 1.0){
      if (gridPos.z < lineWidth || gridPos.z > 1.0 - lineWidth) {
        gridLine = 1.0;
      }
    }
    
    finalColor = mix(finalColor, vec3(1.0), gridLine * 0.5);
  } else if (showGrid) {
    float lineWidth = 0.025;
    vec3 gridPos = fract(vWorldPosition);
    
    float gridLine = 0.0;
    
    if (gridPos.x > 0.0 && gridPos.x < 1.0) {
      if (gridPos.x < lineWidth || gridPos.x > 1.0 - lineWidth) {
        gridLine = 1.0;
      }
    }
    if (gridPos.y > 0.0 && gridPos.y < 1.0){
      if (gridPos.y < lineWidth || gridPos.y > 1.0 - lineWidth) {
        gridLine = 1.0;
      }
    }
    if (gridPos.z > 0.0 && gridPos.z < 1.0){
      if (gridPos.z < lineWidth || gridPos.z > 1.0 - lineWidth) {
        gridLine = 1.0;
      }
    }
    
    finalColor = mix(finalColor, vec3(1.0), gridLine * 0.5);
  }
 
  gl_FragColor = vec4(finalColor, textureColor.a * opacity);
}
`;

export const createVoxelMaterial = (
  textureAtlas: THREE.Texture | null,
  opacity: number = 1,
  showGrid: boolean = false
) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: textureAtlas },
      opacity: { value: opacity },
      showGrid: { value: showGrid },
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });
};
