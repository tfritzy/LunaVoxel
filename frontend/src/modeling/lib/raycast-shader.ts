import * as THREE from "three";

const raycastVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vCameraPositionLocal;

uniform vec3 chunkSize;

void main() {
  vLocalPosition = position;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  
  mat4 inverseModel = inverse(modelMatrix);
  vCameraPositionLocal = (inverseModel * vec4(cameraPosition, 1.0)).xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const raycastFragmentShader = `
precision highp float;
precision highp sampler3D;

uniform sampler3D voxelData;
uniform sampler2D textureAtlas;
uniform vec3 chunkSize;
uniform vec3 chunkMin;
uniform float atlasWidth;
uniform int blockMappings[256 * 6];

varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vCameraPositionLocal;

struct RayHit {
  bool hit;
  vec3 position;
  vec3 normal;
  int blockType;
};

vec3 getVoxelUV(vec3 pos, vec3 normal, int blockType) {
  int faceIndex;
  if (normal.x > 0.5) faceIndex = 0;
  else if (normal.x < -0.5) faceIndex = 1;
  else if (normal.y > 0.5) faceIndex = 2;
  else if (normal.y < -0.5) faceIndex = 3;
  else if (normal.z > 0.5) faceIndex = 4;
  else faceIndex = 5;
  
  int textureIndex = blockMappings[(blockType - 1) * 6 + faceIndex];
  
  float texSize = 1.0 / atlasWidth;
  
  vec2 localUV;
  if (abs(normal.x) > 0.5) {
    localUV = fract(pos.zy);
  } else if (abs(normal.y) > 0.5) {
    localUV = fract(pos.xz);
  } else {
    localUV = fract(pos.xy);
  }
  
  float texX = float(textureIndex) * texSize;
  vec2 atlasUV = vec2(texX + localUV.x * texSize, localUV.y);
  
  return vec3(atlasUV, float(textureIndex));
}

float getDarknessFactor(vec3 normal) {
  if (normal.y > 0.5) return 0.95;
  if (normal.y < -0.5) return 0.6;
  if (abs(normal.x) > 0.5) return 0.9;
  return 0.8;
}

RayHit raycastVoxels(vec3 rayOrigin, vec3 rayDir) {
  RayHit result;
  result.hit = false;
  result.position = vec3(0.0);
  result.normal = vec3(0.0);
  result.blockType = 0;
  
  float epsilon = 0.0001;
  vec3 invDir = 1.0 / (rayDir + vec3(epsilon));
  
  vec3 t0 = (vec3(0.0) - rayOrigin) * invDir;
  vec3 t1 = (chunkSize - rayOrigin) * invDir;
  
  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);
  
  float tEntry = max(max(tMin.x, tMin.y), tMin.z);
  float tExit = min(min(tMax.x, tMax.y), tMax.z);
  
  if (tEntry > tExit || tExit < 0.0) {
    return result;
  }
  
  float t = max(tEntry + epsilon, 0.0);
  vec3 pos = rayOrigin + rayDir * t;
  
  ivec3 mapPos = ivec3(floor(pos));
  
  vec3 deltaDist = abs(invDir);
  
  ivec3 step = ivec3(sign(rayDir));
  
  vec3 sideDist = (sign(rayDir) * (vec3(mapPos) - pos) + sign(rayDir) * 0.5 + 0.5) * deltaDist;
  
  int maxSteps = int(chunkSize.x + chunkSize.y + chunkSize.z) * 2;
  
  ivec3 lastMask = ivec3(0);
  if (tMin.x >= tMin.y && tMin.x >= tMin.z) {
    lastMask = ivec3(1, 0, 0);
  } else if (tMin.y >= tMin.z) {
    lastMask = ivec3(0, 1, 0);
  } else {
    lastMask = ivec3(0, 0, 1);
  }
  
  for (int i = 0; i < 512; i++) {
    if (i >= maxSteps) break;
    
    if (mapPos.x < 0 || mapPos.x >= int(chunkSize.x) ||
        mapPos.y < 0 || mapPos.y >= int(chunkSize.y) ||
        mapPos.z < 0 || mapPos.z >= int(chunkSize.z)) {
      break;
    }
    
    vec3 texCoord = (vec3(mapPos) + 0.5) / chunkSize;
    float voxelValue = texture(voxelData, texCoord).r * 255.0;
    int blockType = int(voxelValue + 0.5);
    
    if (blockType > 0) {
      result.hit = true;
      result.position = pos;
      result.blockType = blockType;
      result.normal = -vec3(lastMask) * vec3(step);
      return result;
    }
    
    if (sideDist.x < sideDist.y) {
      if (sideDist.x < sideDist.z) {
        pos = rayOrigin + rayDir * sideDist.x;
        sideDist.x += deltaDist.x;
        mapPos.x += step.x;
        lastMask = ivec3(1, 0, 0);
      } else {
        pos = rayOrigin + rayDir * sideDist.z;
        sideDist.z += deltaDist.z;
        mapPos.z += step.z;
        lastMask = ivec3(0, 0, 1);
      }
    } else {
      if (sideDist.y < sideDist.z) {
        pos = rayOrigin + rayDir * sideDist.y;
        sideDist.y += deltaDist.y;
        mapPos.y += step.y;
        lastMask = ivec3(0, 1, 0);
      } else {
        pos = rayOrigin + rayDir * sideDist.z;
        sideDist.z += deltaDist.z;
        mapPos.z += step.z;
        lastMask = ivec3(0, 0, 1);
      }
    }
  }
  
  return result;
}

void main() {
  vec3 rayDir = normalize(vLocalPosition - vCameraPositionLocal);
  
  RayHit hit = raycastVoxels(vCameraPositionLocal, rayDir);
  
  if (!hit.hit) {
    discard;
  }
  
  vec3 uvData = getVoxelUV(hit.position, hit.normal, hit.blockType);
  vec4 textureColor = texture2D(textureAtlas, uvData.xy);
  
  float darknessFactor = getDarknessFactor(hit.normal);
  
  vec3 finalColor = textureColor.rgb * darknessFactor;
  
  gl_FragColor = vec4(finalColor, textureColor.a);
}
`;

export const createRaycastVoxelMaterial = (
  voxelDataTexture: THREE.Data3DTexture | null,
  textureAtlas: THREE.Texture | null,
  chunkSize: THREE.Vector3,
  chunkMin: THREE.Vector3,
  atlasWidth: number,
  blockMappings: number[]
) => {
  const flatMappings = new Int32Array(256 * 6);
  for (let i = 0; i < Math.min(blockMappings.length, 256 * 6); i++) {
    flatMappings[i] = blockMappings[i];
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      voxelData: { value: voxelDataTexture },
      textureAtlas: { value: textureAtlas },
      chunkSize: { value: chunkSize },
      chunkMin: { value: chunkMin },
      atlasWidth: { value: atlasWidth },
      blockMappings: { value: flatMappings },
    },
    vertexShader: raycastVertexShader,
    fragmentShader: raycastFragmentShader,
    side: THREE.BackSide,
    transparent: true,
  });

  return material;
};

export const createVoxelData3DTexture = (
  voxelData: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number
): THREE.Data3DTexture => {
  const texture = new THREE.Data3DTexture(voxelData, sizeX, sizeY, sizeZ);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};
