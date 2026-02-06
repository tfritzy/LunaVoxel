import { globalStore } from "./store";
import type {
  Layer,
  Chunk,
  Selection,
  BlockModificationMode,
  Vector3,
} from "./types";
import { generateId } from "@/lib/idGenerator";

const CHUNK_SIZE = 32;

function getChunkId(layerId: string, minX: number, minY: number, minZ: number): string {
  return `${layerId}:${minX},${minY},${minZ}`;
}

function getChunkMinPos(pos: number): number {
  return Math.floor(pos / CHUNK_SIZE) * CHUNK_SIZE;
}

function getOrCreateChunk(
  layerId: string,
  worldX: number,
  worldY: number,
  worldZ: number,
  dimensions: Vector3
): Chunk {
  const minX = getChunkMinPos(worldX);
  const minY = getChunkMinPos(worldY);
  const minZ = getChunkMinPos(worldZ);
  const chunkId = getChunkId(layerId, minX, minY, minZ);
  
  const state = globalStore.getState();
  let chunk = state.chunks.get(chunkId);
  
  if (!chunk) {
    const sizeX = Math.min(CHUNK_SIZE, dimensions.x - minX);
    const sizeY = Math.min(CHUNK_SIZE, dimensions.y - minY);
    const sizeZ = Math.min(CHUNK_SIZE, dimensions.z - minZ);
    
    chunk = {
      id: chunkId,
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
  initializeEditor(
    id: string,
    xDim: number,
    yDim: number,
    zDim: number
  ) {
    const dimensions = { x: xDim, y: yDim, z: zDim };
    globalStore.setDimensions(dimensions);
    
    const layer: Layer = {
      id: generateId("lyr"),
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
          getOrCreateChunk(layer.id, x, y, z, dimensions);
        }
      }
    }
  },

  addLayer() {
    const state = globalStore.getState();
    const dimensions = state.dimensions;

    const existingLayers = Array.from(state.layers.values());
    const maxIndex = existingLayers.length > 0 
      ? Math.max(...existingLayers.map(l => l.index))
      : -1;

    const layer: Layer = {
      id: generateId("lyr"),
      xDim: dimensions.x,
      yDim: dimensions.y,
      zDim: dimensions.z,
      index: maxIndex + 1,
      visible: true,
      locked: false,
      name: `Layer ${maxIndex + 1}`,
    };
    
    globalStore.setLayer(layer);
    
    for (let x = 0; x < dimensions.x; x += CHUNK_SIZE) {
      for (let y = 0; y < dimensions.y; y += CHUNK_SIZE) {
        for (let z = 0; z < dimensions.z; z += CHUNK_SIZE) {
          getOrCreateChunk(layer.id, x, y, z, dimensions);
        }
      }
    }
  },

  deleteLayer(layerId: string) {
    const state = globalStore.getState();
    const layer = state.layers.get(layerId);
    if (!layer) return;

    const allLayers = Array.from(state.layers.values());
    if (allLayers.length <= 1) return;

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

  reorderLayers(newOrder: string[]) {
    const state = globalStore.getState();
    
    for (let i = 0; i < newOrder.length; i++) {
      const layer = state.layers.get(newOrder[i]);
      if (layer) {
        globalStore.setLayer({
          ...layer,
          index: newOrder.length - 1 - i,
        });
      }
    }
  },

  modifyBlockRect(
    mode: BlockModificationMode,
    blockType: number,
    startPos: Vector3,
    endPos: Vector3,
    rotation: number,
    layerIndex: number
  ) {
    const state = globalStore.getState();
    const dimensions = state.dimensions;

    const layer = Array.from(state.layers.values())
      .find(l => l.index === layerIndex);
    if (!layer || layer.locked) return;

    const minX = Math.max(0, Math.min(Math.floor(startPos.x), Math.floor(endPos.x)));
    const maxX = Math.min(dimensions.x - 1, Math.max(Math.floor(startPos.x), Math.floor(endPos.x)));
    const minY = Math.max(0, Math.min(Math.floor(startPos.y), Math.floor(endPos.y)));
    const maxY = Math.min(dimensions.y - 1, Math.max(Math.floor(startPos.y), Math.floor(endPos.y)));
    const minZ = Math.max(0, Math.min(Math.floor(startPos.z), Math.floor(endPos.z)));
    const maxZ = Math.min(dimensions.z - 1, Math.max(Math.floor(startPos.z), Math.floor(endPos.z)));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const chunk = getOrCreateChunk(layer.id, x, y, z, dimensions);
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

  addBlock(_atlasFaceIndexes: number[]) {
  },

  updateBlock(_blockIndex: number, _atlasFaceIndexes: number[]) {
  },

  deleteBlock(blockIndex: number, replacementBlockIndex: number) {
    const state = globalStore.getState();

    for (const chunk of state.chunks.values()) {
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
  },

  undoEdit(
    beforeDiff: Uint8Array,
    afterDiff: Uint8Array,
    layerIndex: number
  ) {
    const state = globalStore.getState();

    const layer = Array.from(state.layers.values())
      .find(l => l.index === layerIndex);
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
    layerIndex: number,
    position: Vector3
  ) {
    const state = globalStore.getState();
    const userId = state.currentUserId;
    if (!userId) return;

    const layer = Array.from(state.layers.values())
      .find(l => l.index === layerIndex);
    if (!layer) return;

    const existingSelection = Array.from(state.selections.values())
      .find(s => s.identityId === userId);
    if (existingSelection) {
      globalStore.deleteSelection(existingSelection.id);
    }

    const selection: Selection = {
      id: generateId("sel"),
      identityId: userId,
      layer: layerIndex,
      selectionFrames: [],
    };
    
    globalStore.setSelection(selection);
  },

  commitSelectionMove(offset: Vector3) {
    const state = globalStore.getState();
    const userId = state.currentUserId;
    if (!userId) return;

    const selection = Array.from(state.selections.values())
      .find(s => s.identityId === userId);
    if (!selection) return;

    globalStore.deleteSelection(selection.id);
  },
};

export type Reducers = typeof reducers;
