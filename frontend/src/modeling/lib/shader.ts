import * as THREE from "three";

const vertexShader = `
attribute float aochannel;
varying vec2 vUv;
varying vec3 vNormal;
varying float vAO;

void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vAO = aochannel;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D map;
varying vec2 vUv;
varying vec3 vNormal;
varying float vAO;

void main() {
  vec4 textureColor = texture2D(map, vUv);
  
  vec3 normal = normalize(vNormal);
  
  float darknessFactor = 1.0;
  
  if (abs(normal.y - 1.0) < 0.1) {
    darknessFactor = 1.0;
  } else if (abs(normal.y + 1.0) < 0.1) {
    darknessFactor = 0.6;
  } else if (abs(normal.x) > 0.9) {
    darknessFactor = 0.9;
  } else if (abs(normal.z) > 0.9) {
    darknessFactor = 0.8;
  }
  
  vec3 finalColor = textureColor.rgb * darknessFactor * vAO;
  
  gl_FragColor = vec4(finalColor, textureColor.a);
}
`;

export const createVoxelMaterial = (textureAtlas: THREE.Texture) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: textureAtlas },
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });
};
