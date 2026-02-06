import { globalStore } from "./store";
import type {
  Project,
  Layer,
  Chunk,
  Selection,
  BlockModificationMode,
  Vector3,
  AccessType,
} from "./types";
import { generateId } from "@/lib/idGenerator";

const CHUNK_SIZE = 32;

function getChunkId(projectId: string, layerId: string, minX: number, minY: number, minZ: number): string {
  return `${projectId}:${layerId}:${minX},${minY},${minZ}`;
}

function getChunkMinPos(pos: number): number {
  return Math.floor(pos / CHUNK_SIZE) * CHUNK_SIZE;
}

function getOrCreateChunk(
  projectId: string,
  layerId: string,
  worldX: number,
  worldY: number,
  worldZ: number,
  dimensions: Vector3
): Chunk {
  const minX = getChunkMinPos(worldX);
  const minY = getChunkMinPos(worldY);
  const minZ = getChunkMinPos(worldZ);
  const chunkId = getChunkId(projectId, layerId, minX, minY, minZ);
  
  const state = globalStore.getState();
  let chunk = state.chunks.get(chunkId);
  
  if (!chunk) {
    const sizeX = Math.min(CHUNK_SIZE, dimensions.x - minX);
    const sizeY = Math.min(CHUNK_SIZE, dimensions.y - minY);
    const sizeZ = Math.min(CHUNK_SIZE, dimensions.z - minZ);
    
    chunk = {
      id: chunkId,
      projectId,
      layerId,
      minPosX: minX,
      minPosY: minY,
      minPosZ: minZ,
      sizeX,
      sizeY,
      sizeZ,
      voxels: new Uint8Array(sizeX * sizeY * sizeZ),
    };
    globalStore.setChunk(chunk);
  }
  
  return chunk;
}

export const reducers = {
  createProject(
    id: string,
    name: string,
    xDim: number,
    yDim: number,
    zDim: number
  ) {
    const state = globalStore.getState();
    const userId = state.currentUserId;
    if (!userId) return;

    const now = Date.now();
    const project: Project = {
      id,
      name,
      dimensions: { x: xDim, y: yDim, z: zDim },
      ownerId: userId,
      updated: now,
      created: now,
      publicAccess: { tag: "ReadWrite" },
    };
    
    globalStore.setProject(project);
    
    const layer: Layer = {
      id: generateId("lyr"),
      projectId: id,
      xDim,
      yDim,
      zDim,
      index: 0,
      visible: true,
      locked: false,
      name: "Layer 0",
    };
    
    globalStore.setLayer(layer);
    
    for (let x = 0; x < xDim; x += CHUNK_SIZE) {
      for (let y = 0; y < yDim; y += CHUNK_SIZE) {
        for (let z = 0; z < zDim; z += CHUNK_SIZE) {
          getOrCreateChunk(id, layer.id, x, y, z, project.dimensions);
        }
      }
    }
  },

  updateProjectName(projectId: string, name: string) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;
    
    globalStore.setProject({
      ...project,
      name,
      updated: Date.now(),
    });
  },

  addLayer(projectId: string) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;

    const existingLayers = Array.from(state.layers.values())
      .filter(l => l.projectId === projectId);
    const maxIndex = existingLayers.length > 0 
      ? Math.max(...existingLayers.map(l => l.index))
      : -1;

    const layer: Layer = {
      id: generateId("lyr"),
      projectId,
      xDim: project.dimensions.x,
      yDim: project.dimensions.y,
      zDim: project.dimensions.z,
      index: maxIndex + 1,
      visible: true,
      locked: false,
      name: `Layer ${maxIndex + 1}`,
    };
    
    globalStore.setLayer(layer);
    
    for (let x = 0; x < project.dimensions.x; x += CHUNK_SIZE) {
      for (let y = 0; y < project.dimensions.y; y += CHUNK_SIZE) {
        for (let z = 0; z < project.dimensions.z; z += CHUNK_SIZE) {
          getOrCreateChunk(projectId, layer.id, x, y, z, project.dimensions);
        }
      }
    }
  },

  deleteLayer(layerId: string) {
    const state = globalStore.getState();
    const layer = state.layers.get(layerId);
    if (!layer) return;

    const projectLayers = Array.from(state.layers.values())
      .filter(l => l.projectId === layer.projectId);
    if (projectLayers.length <= 1) return;

    for (const chunk of state.chunks.values()) {
      if (chunk.layerId === layerId) {
        globalStore.deleteChunk(chunk.id);
      }
    }
    
    globalStore.deleteLayer(layerId);
  },

  toggleLayerVisibility(layerId: string) {
    const state = globalStore.getState();
    const layer = state.layers.get(layerId);
    if (!layer) return;
    
    globalStore.setLayer({
      ...layer,
      visible: !layer.visible,
    });
  },

  toggleLayerLock(layerId: string) {
    const state = globalStore.getState();
    const layer = state.layers.get(layerId);
    if (!layer) return;
    
    globalStore.setLayer({
      ...layer,
      locked: !layer.locked,
    });
  },

  reorderLayers(projectId: string, newOrder: string[]) {
    const state = globalStore.getState();
    
    for (let i = 0; i < newOrder.length; i++) {
      const layer = state.layers.get(newOrder[i]);
      if (layer && layer.projectId === projectId) {
        globalStore.setLayer({
          ...layer,
          index: newOrder.length - 1 - i,
        });
      }
    }
  },

  modifyBlockRect(
    projectId: string,
    mode: BlockModificationMode,
    blockType: number,
    startPos: Vector3,
    endPos: Vector3,
    rotation: number,
    layerIndex: number
  ) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;

    const layer = Array.from(state.layers.values())
      .find(l => l.projectId === projectId && l.index === layerIndex);
    if (!layer || layer.locked) return;

    const minX = Math.max(0, Math.min(Math.floor(startPos.x), Math.floor(endPos.x)));
    const maxX = Math.min(project.dimensions.x - 1, Math.max(Math.floor(startPos.x), Math.floor(endPos.x)));
    const minY = Math.max(0, Math.min(Math.floor(startPos.y), Math.floor(endPos.y)));
    const maxY = Math.min(project.dimensions.y - 1, Math.max(Math.floor(startPos.y), Math.floor(endPos.y)));
    const minZ = Math.max(0, Math.min(Math.floor(startPos.z), Math.floor(endPos.z)));
    const maxZ = Math.min(project.dimensions.z - 1, Math.max(Math.floor(startPos.z), Math.floor(endPos.z)));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const chunk = getOrCreateChunk(projectId, layer.id, x, y, z, project.dimensions);
          const localX = x - chunk.minPosX;
          const localY = y - chunk.minPosY;
          const localZ = z - chunk.minPosZ;
          const voxelIndex = localX * chunk.sizeY * chunk.sizeZ + localY * chunk.sizeZ + localZ;

          const newVoxels = new Uint8Array(chunk.voxels);
          
          switch (mode.tag) {
            case "Attach":
              newVoxels[voxelIndex] = blockType;
              break;
            case "Erase":
              newVoxels[voxelIndex] = 0;
              break;
            case "Paint":
              if (newVoxels[voxelIndex] !== 0) {
                newVoxels[voxelIndex] = blockType;
              }
              break;
          }
          
          globalStore.setChunk({
            ...chunk,
            voxels: newVoxels,
          });
        }
      }
    }
  },

  addBlock(projectId: string, atlasFaceIndexes: number[]) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;
    
    globalStore.setProject({
      ...project,
      updated: Date.now(),
    });
  },

  updateBlock(projectId: string, blockIndex: number, atlasFaceIndexes: number[]) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;
    
    globalStore.setProject({
      ...project,
      updated: Date.now(),
    });
  },

  deleteBlock(projectId: string, blockIndex: number, replacementBlockIndex: number) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;

    for (const chunk of state.chunks.values()) {
      if (chunk.projectId !== projectId) continue;
      
      let modified = false;
      const newVoxels = new Uint8Array(chunk.voxels);
      
      for (let i = 0; i < newVoxels.length; i++) {
        if (newVoxels[i] === blockIndex) {
          newVoxels[i] = replacementBlockIndex;
          modified = true;
        } else if (newVoxels[i] > blockIndex) {
          newVoxels[i] = newVoxels[i] - 1;
          modified = true;
        }
      }
      
      if (modified) {
        globalStore.setChunk({
          ...chunk,
          voxels: newVoxels,
        });
      }
    }
    
    globalStore.setProject({
      ...project,
      updated: Date.now(),
    });
  },

  undoEdit(
    projectId: string,
    beforeDiff: Uint8Array,
    afterDiff: Uint8Array,
    layerIndex: number
  ) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;

    const layer = Array.from(state.layers.values())
      .find(l => l.projectId === projectId && l.index === layerIndex);
    if (!layer) return;

    for (const chunk of state.chunks.values()) {
      if (chunk.layerId !== layer.id) continue;
      
      const newVoxels = new Uint8Array(chunk.voxels);
      let modified = false;
      
      for (let i = 0; i < newVoxels.length && i < beforeDiff.length; i++) {
        if (beforeDiff[i] !== 0) {
          newVoxels[i] = beforeDiff[i];
          modified = true;
        }
      }
      
      if (modified) {
        globalStore.setChunk({
          ...chunk,
          voxels: newVoxels,
        });
      }
    }
  },

  magicSelect(
    projectId: string,
    layerIndex: number,
    position: Vector3
  ) {
    const state = globalStore.getState();
    const userId = state.currentUserId;
    if (!userId) return;

    const project = state.projects.get(projectId);
    if (!project) return;

    const layer = Array.from(state.layers.values())
      .find(l => l.projectId === projectId && l.index === layerIndex);
    if (!layer) return;

    const existingSelection = Array.from(state.selections.values())
      .find(s => s.projectId === projectId && s.identityId === userId);
    if (existingSelection) {
      globalStore.deleteSelection(existingSelection.id);
    }

    const selection: Selection = {
      id: generateId("sel"),
      identityId: userId,
      projectId,
      layer: layerIndex,
      selectionFrames: [],
    };
    
    globalStore.setSelection(selection);
  },

  commitSelectionMove(projectId: string, offset: Vector3) {
    const state = globalStore.getState();
    const userId = state.currentUserId;
    if (!userId) return;

    const selection = Array.from(state.selections.values())
      .find(s => s.projectId === projectId && s.identityId === userId);
    if (!selection) return;

    globalStore.deleteSelection(selection.id);
  },

  updateCursorPos(
    projectId: string,
    playerId: string,
    position: Vector3,
    normal: Vector3
  ) {
  },

  changePublicAccessToProject(projectId: string, accessType: AccessType) {
    const state = globalStore.getState();
    const project = state.projects.get(projectId);
    if (!project) return;
    
    globalStore.setProject({
      ...project,
      publicAccess: accessType,
      updated: Date.now(),
    });
  },
};

export type Reducers = typeof reducers;
