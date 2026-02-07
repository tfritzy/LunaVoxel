import { useSyncExternalStore } from "react";
import type {
  BlockModificationMode,
  Layer,
  Project,
  ProjectBlocks,
  Vector3,
} from "./types";
import { SparseVoxelOctree } from "@/modeling/lib/sparse-voxel-octree";

export type GlobalState = {
  project: Project;
  layers: Layer[];
  blocks: ProjectBlocks;
  layerOctrees: Map<string, SparseVoxelOctree>;
};

export type Reducers = {
  updateProjectName: (projectId: string, name: string) => void;
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

const createInitialState = (): GlobalState => {
  const projectId = "local-project";
  const project: Project = {
    id: projectId,
    name: "Local Project",
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

  const layerOctrees = new Map<string, SparseVoxelOctree>();
  const seedOctree = new SparseVoxelOctree(project.dimensions);

  const setVoxel = (x: number, y: number, z: number, value: number) => {
    seedOctree.set(x, y, z, value);
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

  layerOctrees.set(layerId, seedOctree);

  return { project, layers, blocks, layerOctrees };
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


const getOrCreateOctree = (layerId: string): SparseVoxelOctree => {
  let octree = state.layerOctrees.get(layerId);
  if (!octree) {
    octree = new SparseVoxelOctree(state.project.dimensions);
    state.layerOctrees.set(layerId, octree);
  }
  return octree;
};

const applyBlockAt = (
  octree: SparseVoxelOctree,
  mode: BlockModificationMode,
  x: number,
  y: number,
  z: number,
  blockType: number
) => {
  const current = octree.get(x, y, z);

  switch (mode.tag) {
    case "Attach":
      octree.set(x, y, z, blockType);
      break;
    case "Erase":
      octree.set(x, y, z, 0);
      break;
    case "Paint":
      if (current !== 0) {
        octree.set(x, y, z, blockType);
      }
      break;
  }
};

const reducers: Reducers = {
  updateProjectName: (_projectId, name) => {
    void _projectId;
    updateState((current) => {
      current.project.name = name;
    });
  },
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

      for (const octree of current.layerOctrees.values()) {
        octree.updateValues((value) => {
          if (value === blockIndex) {
            return replacementBlockType;
          }
          if (value > blockIndex) {
            return value - 1;
          }
          return value;
        });
      }
    });
  },
  addLayer: (_projectId) => {
    void _projectId;
    updateState((current) => {
      const nextIndex = current.layers.length;
      const id = createId();
      current.layers.push({
        id,
        projectId: current.project.id,
        index: nextIndex,
        name: `Layer ${nextIndex + 1}`,
        visible: true,
        locked: false,
      });
      current.layerOctrees.set(id, new SparseVoxelOctree(current.project.dimensions));
    });
  },
  deleteLayer: (layerId) => {
    updateState((current) => {
      const target = current.layers.find((layer) => layer.id === layerId);
      if (!target) return;
      current.layers = current.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer, index) => ({ ...layer, index }));

      current.layerOctrees.delete(layerId);
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

      const octree = getOrCreateOctree(layer.id);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            applyBlockAt(octree, mode, x, y, z, blockType);
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
