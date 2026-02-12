import { useSyncExternalStore } from "react";
import { CHUNK_SIZE } from "./constants";
import type {
  BlockModificationMode,
  ChunkData,
  Layer,
  Project,
  ProjectBlocks,
  Vector3,
} from "./types";
import { RAYCASTABLE_BIT } from "@/modeling/lib/voxel-constants";

export type GlobalState = {
  project: Project;
  layers: Layer[];
  blocks: ProjectBlocks;
  chunks: Map<string, ChunkData>;
};

export type Reducers = {
  addBlock: (projectId: string, faceColors: number[]) => void;
  updateBlock: (projectId: string, index: number, faceColors: number[]) => void;
  deleteBlock: (
    projectId: string,
    blockIndex: number,
    replacementBlockType: number
  ) => void;
  addLayer: (projectId: string) => void;
  deleteLayer: (layerId: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  reorderLayers: (projectId: string, layerIds: string[]) => void;
  modifyBlockRect: (
    projectId: string,
    mode: BlockModificationMode,
    blockType: number,
    start: Vector3,
    end: Vector3,
    rotation: number,
    layerIndex: number
  ) => void;
  undoEdit: (
    projectId: string,
    beforeDiff: Uint8Array,
    afterDiff: Uint8Array,
    layer: number
  ) => void;
  updateCursorPos: (
    projectId: string,
    playerId: string,
    position: Vector3,
    normal: Vector3
  ) => void;
  magicSelect: (projectId: string, layerIndex: number, pos: Vector3) => void;
  commitSelectionMove: (projectId: string, offset: Vector3) => void;
};

export type StateStore = {
  getState: () => GlobalState;
  subscribe: (listener: () => void) => () => void;
  reducers: Reducers;
};

const createId = () =>
  `layer_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const getChunkKey = (layerId: string, minPos: Vector3) =>
  `${layerId}:${minPos.x},${minPos.y},${minPos.z}`;

const createChunkData = (
  project: Project,
  layerId: string,
  minPos: Vector3
): ChunkData => {
  const size = {
    x: Math.min(CHUNK_SIZE, project.dimensions.x - minPos.x),
    y: Math.min(CHUNK_SIZE, project.dimensions.y - minPos.y),
    z: Math.min(CHUNK_SIZE, project.dimensions.z - minPos.z),
  };
  const voxels = new Uint8Array(size.x * size.y * size.z);
  return {
    key: getChunkKey(layerId, minPos),
    projectId: project.id,
    layerId,
    minPos,
    size,
    voxels,
  };
};

const createInitialState = (): GlobalState => {
  const projectId = "local-project";
  const project: Project = {
    id: projectId,
    dimensions: { x: 64, y: 64, z: 64 },
  };

  const layerId = createId();
  const layers: Layer[] = [
    {
      id: layerId,
      projectId,
      index: 0,
      name: "Layer 1",
      visible: true,
      locked: false,
    },
  ];

  const blocks: ProjectBlocks = {
    projectId,
    faceColors: [
      Array(6).fill(0xff6b6b),
      Array(6).fill(0xffd166),
      Array(6).fill(0x4dabf7),
    ],
  };

  const chunks = new Map<string, ChunkData>();
  const seedChunk = createChunkData(project, layerId, { x: 0, y: 0, z: 0 });

  const setVoxel = (x: number, y: number, z: number, value: number) => {
    if (
      x < 0 ||
      y < 0 ||
      z < 0 ||
      x >= seedChunk.size.x ||
      y >= seedChunk.size.y ||
      z >= seedChunk.size.z
    )
      return;
    const index = x * seedChunk.size.y * seedChunk.size.z + y * seedChunk.size.z + z;
    seedChunk.voxels[index] = value;
  };

  for (let x = 10; x <= 14; x++) {
    for (let y = 0; y <= 3; y++) {
      for (let z = 10; z <= 14; z++) {
        setVoxel(x, y, z, 1);
      }
    }
  }

  for (let x = 11; x <= 13; x++) {
    for (let y = 4; y <= 6; y++) {
      for (let z = 11; z <= 13; z++) {
        setVoxel(x, y, z, 2);
      }
    }
  }

  chunks.set(seedChunk.key, seedChunk);

  return { project, layers, blocks, chunks };
};

let state = createInitialState();
let version = 0;
const listeners = new Set<() => void>();

const notify = () => {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
};

const updateState = (mutator: (current: GlobalState) => void) => {
  mutator(state);
  notify();
};

const getLayerByIndex = (layerIndex: number) =>
  state.layers.find((layer) => layer.index === layerIndex);


const getOrCreateChunk = (layerId: string, minPos: Vector3) => {
  const key = getChunkKey(layerId, minPos);
  let chunk = state.chunks.get(key);
  if (!chunk) {
    chunk = createChunkData(state.project, layerId, minPos);
    state.chunks.set(key, chunk);
  }
  return chunk;
};

const applyBlockAt = (
  chunk: ChunkData,
  mode: BlockModificationMode,
  localX: number,
  localY: number,
  localZ: number,
  blockType: number
) => {
  const index =
    localX * chunk.size.y * chunk.size.z +
    localY * chunk.size.z +
    localZ;

  switch (mode.tag) {
    case "Attach":
      chunk.voxels[index] = blockType | RAYCASTABLE_BIT;
      break;
    case "Erase":
      chunk.voxels[index] = 0;
      break;
    case "Paint":
      if (chunk.voxels[index] !== 0) {
        chunk.voxels[index] = blockType | RAYCASTABLE_BIT;
      }
      break;
  }
};

const reducers: Reducers = {
  addBlock: (_projectId, faceColors) => {
    void _projectId;
    updateState((current) => {
      current.blocks.faceColors.push([...faceColors]);
    });
  },
  updateBlock: (_projectId, index, faceColors) => {
    void _projectId;
    updateState((current) => {
      if (!current.blocks.faceColors[index]) return;
      current.blocks.faceColors[index] = [...faceColors];
    });
  },
  deleteBlock: (_projectId, blockIndex, replacementBlockType) => {
    void _projectId;
    updateState((current) => {
      const zeroBasedIndex = blockIndex - 1;
      if (zeroBasedIndex < 0 || zeroBasedIndex >= current.blocks.faceColors.length) {
        return;
      }

      current.blocks.faceColors.splice(zeroBasedIndex, 1);

      for (const chunk of current.chunks.values()) {
        for (let i = 0; i < chunk.voxels.length; i++) {
          const value = chunk.voxels[i];
          if (value === blockIndex) {
            chunk.voxels[i] = replacementBlockType;
          } else if (value > blockIndex) {
            chunk.voxels[i] = value - 1;
          }
        }
      }
    });
  },
  addLayer: (_projectId) => {
    void _projectId;
    updateState((current) => {
      const nextIndex = current.layers.length;
      current.layers.push({
        id: createId(),
        projectId: current.project.id,
        index: nextIndex,
        name: `Layer ${nextIndex + 1}`,
        visible: true,
        locked: false,
      });
    });
  },
  deleteLayer: (layerId) => {
    updateState((current) => {
      const target = current.layers.find((layer) => layer.id === layerId);
      if (!target) return;
      current.layers = current.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer, index) => ({ ...layer, index }));

      for (const [key, chunk] of current.chunks.entries()) {
        if (chunk.layerId === layerId) {
          current.chunks.delete(key);
        }
      }
    });
  },
  toggleLayerVisibility: (layerId) => {
    updateState((current) => {
      const layer = current.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.visible = !layer.visible;
      }
    });
  },
  toggleLayerLock: (layerId) => {
    updateState((current) => {
      const layer = current.layers.find((l) => l.id === layerId);
      if (layer) {
        layer.locked = !layer.locked;
      }
    });
  },
  reorderLayers: (_projectId, layerIds) => {
    void _projectId;
    updateState((current) => {
      const nextLayers: Layer[] = [];
      for (const layerId of layerIds) {
        const layer = current.layers.find((l) => l.id === layerId);
        if (layer) {
          nextLayers.push(layer);
        }
      }
      current.layers.forEach((layer) => {
        if (!nextLayers.includes(layer)) {
          nextLayers.push(layer);
        }
      });
      current.layers = nextLayers.map((layer, index) => ({
        ...layer,
        index,
      }));
    });
  },
  modifyBlockRect: (
    _projectId,
    mode,
    blockType,
    start,
    end,
    _rotation,
    layerIndex
  ) => {
    void _projectId;
    updateState((current) => {
      const layer = getLayerByIndex(layerIndex);
      if (!layer || layer.locked) return;

      const dims = current.project.dimensions;
      const minX = Math.max(0, Math.floor(Math.min(start.x, end.x)));
      const minY = Math.max(0, Math.floor(Math.min(start.y, end.y)));
      const minZ = Math.max(0, Math.floor(Math.min(start.z, end.z)));
      const maxX = Math.min(dims.x - 1, Math.floor(Math.max(start.x, end.x)));
      const maxY = Math.min(dims.y - 1, Math.floor(Math.max(start.y, end.y)));
      const maxZ = Math.min(dims.z - 1, Math.floor(Math.max(start.z, end.z)));

      for (
        let chunkX = Math.floor(minX / CHUNK_SIZE) * CHUNK_SIZE;
        chunkX <= maxX;
        chunkX += CHUNK_SIZE
      ) {
        for (
          let chunkY = Math.floor(minY / CHUNK_SIZE) * CHUNK_SIZE;
          chunkY <= maxY;
          chunkY += CHUNK_SIZE
        ) {
          for (
            let chunkZ = Math.floor(minZ / CHUNK_SIZE) * CHUNK_SIZE;
            chunkZ <= maxZ;
            chunkZ += CHUNK_SIZE
          ) {
            const chunk = getOrCreateChunk(layer.id, {
              x: chunkX,
              y: chunkY,
              z: chunkZ,
            });

            const localMinX = Math.max(0, minX - chunkX);
            const localMaxX = Math.min(chunk.size.x - 1, maxX - chunkX);
            const localMinY = Math.max(0, minY - chunkY);
            const localMaxY = Math.min(chunk.size.y - 1, maxY - chunkY);
            const localMinZ = Math.max(0, minZ - chunkZ);
            const localMaxZ = Math.min(chunk.size.z - 1, maxZ - chunkZ);

            for (let x = localMinX; x <= localMaxX; x++) {
              for (let y = localMinY; y <= localMaxY; y++) {
                for (let z = localMinZ; z <= localMaxZ; z++) {
                  applyBlockAt(chunk, mode, x, y, z, blockType);
                }
              }
            }
          }
        }
      }
    });
  },
  undoEdit: () => {
    notify();
  },
  updateCursorPos: () => {},
  magicSelect: () => {},
  commitSelectionMove: () => {},
};

export const stateStore: StateStore = {
  getState: () => state,
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reducers,
};

export const useGlobalState = <T,>(
  selector: (current: GlobalState) => T
) => {
  useSyncExternalStore(
    stateStore.subscribe,
    () => version,
    () => version
  );
  return selector(stateStore.getState());
};

export const resetState = () => {
  state = createInitialState();
  notify();
};
