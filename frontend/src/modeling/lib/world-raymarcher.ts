import * as THREE from "three";
import type { BlockModificationMode, Layer, Vector3 } from "@/state/types";
import type { StateStore } from "@/state/store";
import { AtlasData } from "@/lib/useAtlas";
import { VoxelFrame } from "./voxel-frame";
import { IChunkManager, IChunk, ILayerChunk } from "./chunk-interface";

const raycastVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vCameraPositionLocal;

uniform vec3 worldSize;

void main() {
  // Convert from box-centered coordinates to 0-based coordinates
  vLocalPosition = position + worldSize * 0.5;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  
  mat4 inverseModel = inverse(modelMatrix);
  vec3 cameraLocal = (inverseModel * vec4(cameraPosition, 1.0)).xyz;
  vCameraPositionLocal = cameraLocal + worldSize * 0.5;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const raycastFragmentShader = `
precision highp float;
precision highp sampler3D;

uniform sampler3D voxelData;
uniform sampler2D textureAtlas;
uniform vec3 worldSize;
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
  vec3 t1 = (worldSize - rayOrigin) * invDir;
  
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
  
  int maxSteps = int(worldSize.x + worldSize.y + worldSize.z) * 2;
  
  ivec3 lastMask = ivec3(0);
  if (tMin.x >= tMin.y && tMin.x >= tMin.z) {
    lastMask = ivec3(1, 0, 0);
  } else if (tMin.y >= tMin.z) {
    lastMask = ivec3(0, 1, 0);
  } else {
    lastMask = ivec3(0, 0, 1);
  }
  
  for (int i = 0; i < 1024; i++) {
    if (i >= maxSteps) break;
    
    if (mapPos.x < 0 || mapPos.x >= int(worldSize.x) ||
        mapPos.y < 0 || mapPos.y >= int(worldSize.y) ||
        mapPos.z < 0 || mapPos.z >= int(worldSize.z)) {
      break;
    }
    
    vec3 texCoord = (vec3(mapPos) + 0.5) / worldSize;
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

class WorldChunkProxy implements IChunk {
  public readonly minPos: Vector3;
  public readonly size: Vector3;
  private voxelData: Uint8Array;
  
  constructor(minPos: Vector3, size: Vector3, voxelData: Uint8Array) {
    this.minPos = minPos;
    this.size = size;
    this.voxelData = voxelData;
  }
  
  getMesh(): THREE.Mesh | null {
    return null;
  }
  
  getLayerChunk(_layerIndex: number): ILayerChunk | null {
    return { voxels: this.voxelData };
  }
}

export class WorldRaymarcher implements IChunkManager {
  private scene: THREE.Scene;
  private dimensions: Vector3;
  private stateStore: StateStore;
  private projectId: string;
  private layers: Layer[] = [];
  private layerVisibilityMap: Map<number, boolean> = new Map();
  private atlasData: AtlasData | undefined;
  private getMode: () => BlockModificationMode;
  private unsubscribe?: () => void;
  private readonly maxLayers = 10;
  
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.BoxGeometry | null = null;
  private voxelDataTexture: THREE.Data3DTexture | null = null;
  
  private worldVoxelData: Uint8Array;
  private renderedVoxelData: Uint8Array;
  private layerData: Map<string, { layerIndex: number; voxels: Uint8Array; minPos: Vector3; size: Vector3 }> = new Map();

  private getWorldIndex(x: number, y: number, z: number): number {
    return x + y * this.dimensions.x + z * this.dimensions.x * this.dimensions.y;
  }

  constructor(
    scene: THREE.Scene,
    dimensions: Vector3,
    stateStore: StateStore,
    projectId: string,
    getMode: () => BlockModificationMode
  ) {
    this.scene = scene;
    this.dimensions = dimensions;
    this.stateStore = stateStore;
    this.projectId = projectId;
    this.getMode = getMode;
    
    const totalVoxels = dimensions.x * dimensions.y * dimensions.z;
    this.worldVoxelData = new Uint8Array(totalVoxels);
    this.renderedVoxelData = new Uint8Array(totalVoxels);
    
    this.handleStateChange();
    this.unsubscribe = this.stateStore.subscribe(this.handleStateChange);
  }

  private handleStateChange = () => {
    const current = this.stateStore.getState();
    this.layers = current.layers
      .filter((layer) => layer.projectId === this.projectId)
      .sort((a, b) => a.index - b.index);

    this.layerVisibilityMap.clear();
    for (const layer of this.layers) {
      this.layerVisibilityMap.set(layer.index, layer.visible);
    }

    const layerIndexById = new Map(
      this.layers.map((layer) => [layer.id, layer.index])
    );

    this.layerData.clear();
    
    for (const chunkData of current.chunks.values()) {
      if (chunkData.projectId !== this.projectId) continue;
      const layerIndex = layerIndexById.get(chunkData.layerId);
      if (layerIndex === undefined) continue;
      
      this.layerData.set(chunkData.key, {
        layerIndex,
        voxels: chunkData.voxels,
        minPos: chunkData.minPos,
        size: chunkData.size
      });
    }

    this.rebuildWorldVoxelData();
  };

  private rebuildWorldVoxelData(): void {
    this.worldVoxelData.fill(0);
    
    for (const { layerIndex, voxels, minPos, size } of this.layerData.values()) {
      if (!this.layerVisibilityMap.get(layerIndex)) continue;
      
      const chunkSizeX = size.x;
      const chunkSizeY = size.y;
      const chunkSizeZ = size.z;
      
      for (let lx = 0; lx < chunkSizeX; lx++) {
        for (let ly = 0; ly < chunkSizeY; ly++) {
          for (let lz = 0; lz < chunkSizeZ; lz++) {
            const localIndex = lx * chunkSizeY * chunkSizeZ + ly * chunkSizeZ + lz;
            const blockValue = voxels[localIndex];
            
            if (blockValue > 0) {
              const worldX = minPos.x + lx;
              const worldY = minPos.y + ly;
              const worldZ = minPos.z + lz;
              const worldIndex = this.getWorldIndex(worldX, worldY, worldZ);
              this.worldVoxelData[worldIndex] = blockValue;
            }
          }
        }
      }
    }
    
    this.updateRendering();
  }

  private needsUpdate(): boolean {
    for (let i = 0; i < this.worldVoxelData.length; i++) {
      if (this.worldVoxelData[i] !== this.renderedVoxelData[i]) {
        return true;
      }
    }
    return false;
  }

  private updateRendering(): void {
    if (!this.atlasData) return;
    if (!this.needsUpdate() && this.mesh) return;
    
    if (!this.mesh) {
      this.createMesh();
    } else {
      this.updateVoxelTexture();
    }
    
    this.renderedVoxelData.set(this.worldVoxelData);
  }

  private createMesh(): void {
    if (!this.atlasData) return;
    
    const blockMappings: number[] = [];
    if (this.atlasData.blockAtlasMappings) {
      for (const blockMapping of this.atlasData.blockAtlasMappings) {
        blockMappings.push(...blockMapping);
      }
    }
    
    const flatMappings = new Int32Array(256 * 6);
    for (let i = 0; i < Math.min(blockMappings.length, 256 * 6); i++) {
      flatMappings[i] = blockMappings[i];
    }
    
    this.geometry = new THREE.BoxGeometry(
      this.dimensions.x, 
      this.dimensions.y, 
      this.dimensions.z
    );
    
    this.voxelDataTexture = new THREE.Data3DTexture(
      this.worldVoxelData,
      this.dimensions.x,
      this.dimensions.y,
      this.dimensions.z
    );
    this.voxelDataTexture.format = THREE.RedFormat;
    this.voxelDataTexture.type = THREE.UnsignedByteType;
    this.voxelDataTexture.minFilter = THREE.NearestFilter;
    this.voxelDataTexture.magFilter = THREE.NearestFilter;
    this.voxelDataTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.voxelDataTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.voxelDataTexture.wrapR = THREE.ClampToEdgeWrapping;
    this.voxelDataTexture.needsUpdate = true;
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        voxelData: { value: this.voxelDataTexture },
        textureAtlas: { value: this.atlasData.texture },
        worldSize: { value: new THREE.Vector3(this.dimensions.x, this.dimensions.y, this.dimensions.z) },
        atlasWidth: { value: this.atlasData.texture?.image.width || 1 },
        blockMappings: { value: flatMappings },
      },
      vertexShader: raycastVertexShader,
      fragmentShader: raycastFragmentShader,
      side: THREE.BackSide,
      transparent: true,
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(
      this.dimensions.x / 2,
      this.dimensions.y / 2,
      this.dimensions.z / 2
    );
    this.scene.add(this.mesh);
  }

  private updateVoxelTexture(): void {
    if (!this.voxelDataTexture) return;
    
    (this.voxelDataTexture.image.data as Uint8Array).set(this.worldVoxelData);
    this.voxelDataTexture.needsUpdate = true;
  }

  private updateBlockMappings(): void {
    if (!this.material || !this.atlasData?.blockAtlasMappings) return;
    
    const flatMappings = new Int32Array(256 * 6);
    for (let blockType = 0; blockType < this.atlasData.blockAtlasMappings.length; blockType++) {
      const blockMapping = this.atlasData.blockAtlasMappings[blockType];
      for (let face = 0; face < 6; face++) {
        flatMappings[blockType * 6 + face] = blockMapping[face];
      }
    }
    this.material.uniforms.blockMappings.value = flatMappings;
  }

  public getLayer(layerIndex: number): Layer | undefined {
    return this.layers.find((l) => l.index === layerIndex);
  }

  setTextureAtlas = (atlasData: AtlasData) => {
    this.atlasData = atlasData;
    
    if (this.material) {
      this.material.uniforms.textureAtlas.value = atlasData.texture;
      this.material.uniforms.atlasWidth.value = atlasData.texture?.image.width || 1;
      this.updateBlockMappings();
      this.material.needsUpdate = true;
    }
    
    this.updateRendering();
  };

  setPreview = (_previewFrame: VoxelFrame) => {
    // Preview support not implemented for raymarching mode - would need to blend preview
    // voxels into the world texture with a different rendering approach
  };

  public getBlockAtPosition(position: THREE.Vector3, layer: Layer): number | null {
    if (!this.layerVisibilityMap.get(layer.index)) return 0;
    
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    const z = Math.floor(position.z);
    
    if (x < 0 || x >= this.dimensions.x ||
        y < 0 || y >= this.dimensions.y ||
        z < 0 || z >= this.dimensions.z) {
      return 0;
    }
    
    const index = this.getWorldIndex(x, y, z);
    return this.worldVoxelData[index] || 0;
  }

  public getChunks(): IChunk[] {
    return [new WorldChunkProxy(
      { x: 0, y: 0, z: 0 },
      this.dimensions,
      this.worldVoxelData
    )];
  }

  public applyOptimisticRect(
    layer: Layer,
    mode: BlockModificationMode,
    start: THREE.Vector3,
    end: THREE.Vector3,
    blockType: number,
    _rotation: number
  ) {
    if (layer.locked) return;
    if (!this.layerVisibilityMap.get(layer.index)) return;

    const minX = Math.max(0, Math.floor(Math.min(start.x, end.x)));
    const maxX = Math.min(this.dimensions.x - 1, Math.floor(Math.max(start.x, end.x)));
    const minY = Math.max(0, Math.floor(Math.min(start.y, end.y)));
    const maxY = Math.min(this.dimensions.y - 1, Math.floor(Math.max(start.y, end.y)));
    const minZ = Math.max(0, Math.floor(Math.min(start.z, end.z)));
    const maxZ = Math.min(this.dimensions.z - 1, Math.floor(Math.max(start.z, end.z)));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const index = this.getWorldIndex(x, y, z);
          
          switch (mode.tag) {
            case "Attach":
              this.worldVoxelData[index] = blockType;
              break;
            case "Erase":
              this.worldVoxelData[index] = 0;
              break;
            case "Paint":
              if (this.worldVoxelData[index] !== 0) {
                this.worldVoxelData[index] = blockType;
              }
              break;
          }
        }
      }
    }
    
    this.updateRendering();
  }

  dispose = () => {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.voxelDataTexture) {
      this.voxelDataTexture.dispose();
      this.voxelDataTexture = null;
    }
  };
}
