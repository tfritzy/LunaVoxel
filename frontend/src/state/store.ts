import { useSyncExternalStore } from "react";
import { CHUNK_SIZE } from "./constants";
import type {
  BlockModificationMode,
  ChunkData,
  VoxelObject,
  Project,
  ProjectBlocks,
  Vector3,
} from "./types";
import { RAYCASTABLE_BIT } from "@/modeling/lib/voxel-constants";

export type GlobalState = {
  project: Project;
  objects: VoxelObject[];
  blocks: ProjectBlocks;
  chunks: Map<string, ChunkData>;
};

export type Reducers = {
  updateBlock: (projectId: string, index: number, faceColors: number[]) => void;
  addObject: (projectId: string) => void;
  deleteObject: (objectId: string) => void;
  toggleObjectVisibility: (objectId: string) => void;
  toggleObjectLock: (objectId: string) => void;
  reorderObjects: (projectId: string, objectIds: string[]) => void;
  modifyBlockRect: (
    projectId: string,
    mode: BlockModificationMode,
    blockType: number,
    start: Vector3,
    end: Vector3,
    rotation: number,
    objectIndex: number
  ) => void;
  undoEdit: (
    projectId: string,
    beforeDiff: Uint8Array,
    afterDiff: Uint8Array,
    object: number
  ) => void;
  updateCursorPos: (
    projectId: string,
    playerId: string,
    position: Vector3,
    normal: Vector3
  ) => void;
  magicSelect: (projectId: string, objectIndex: number, pos: Vector3) => void;
  commitSelectionMove: (projectId: string, offset: Vector3) => void;
};

export type StateStore = {
  getState: () => GlobalState;
  subscribe: (listener: () => void) => () => void;
  reducers: Reducers;
};

const createId = () =>
  `obj_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const getChunkKey = (objectId: string, minPos: Vector3) =>
  `${objectId}:${minPos.x},${minPos.y},${minPos.z}`;

const createChunkData = (
  project: Project,
  objectId: string,
  minPos: Vector3
): ChunkData => {
  const size = {
    x: Math.min(CHUNK_SIZE, project.dimensions.x - minPos.x),
    y: Math.min(CHUNK_SIZE, project.dimensions.y - minPos.y),
    z: Math.min(CHUNK_SIZE, project.dimensions.z - minPos.z),
  };
  const voxels = new Uint8Array(size.x * size.y * size.z);
  return {
    key: getChunkKey(objectId, minPos),
    projectId: project.id,
    objectId,
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

  const objectId = createId();
  const objects: VoxelObject[] = [
    {
      id: objectId,
      projectId,
      index: 0,
      name: "Object 1",
      visible: true,
      locked: false,
      position: { x: 0, y: 0, z: 0 },
      dimensions: { x: 64, y: 64, z: 64 },
    },
  ];

  const DEFAULT_BLOCK_COLOR = 0x181826;
  const blocks: ProjectBlocks = {
    projectId,
    faceColors: Array.from({ length: 127 }, () => Array(6).fill(DEFAULT_BLOCK_COLOR)),
  };

  const chunks = new Map<string, ChunkData>();
  const seedChunk = createChunkData(project, objectId, { x: 0, y: 0, z: 0 });

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
    seedChunk.voxels[index] = value | RAYCASTABLE_BIT;
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

  return { project, objects, blocks, chunks };
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

const getObjectByIndex = (objectIndex: number) =>
  state.objects.find((obj) => obj.index === objectIndex);


const getOrCreateChunk = (objectId: string, minPos: Vector3) => {
  const key = getChunkKey(objectId, minPos);
  let chunk = state.chunks.get(key);
  if (!chunk) {
    chunk = createChunkData(state.project, objectId, minPos);
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
  updateBlock: (_projectId, index, faceColors) => {
    void _projectId;
    updateState((current) => {
      if (!current.blocks.faceColors[index]) return;
      current.blocks.faceColors[index] = [...faceColors];
    });
  },
  addObject: (_projectId) => {
    void _projectId;
    updateState((current) => {
      const nextIndex = current.objects.length;
      current.objects.push({
        id: createId(),
        projectId: current.project.id,
        index: nextIndex,
        name: `Object ${nextIndex + 1}`,
        visible: true,
        locked: false,
        position: { x: 0, y: 0, z: 0 },
        dimensions: { x: 64, y: 64, z: 64 },
      });
    });
  },
  deleteObject: (objectId) => {
    updateState((current) => {
      const target = current.objects.find((obj) => obj.id === objectId);
      if (!target) return;
      current.objects = current.objects
        .filter((obj) => obj.id !== objectId)
        .map((obj, index) => ({ ...obj, index }));

      for (const [key, chunk] of current.chunks.entries()) {
        if (chunk.objectId === objectId) {
          current.chunks.delete(key);
        }
      }
    });
  },
  toggleObjectVisibility: (objectId) => {
    updateState((current) => {
      const obj = current.objects.find((o) => o.id === objectId);
      if (obj) {
        obj.visible = !obj.visible;
      }
    });
  },
  toggleObjectLock: (objectId) => {
    updateState((current) => {
      const obj = current.objects.find((o) => o.id === objectId);
      if (obj) {
        obj.locked = !obj.locked;
      }
    });
  },
  reorderObjects: (_projectId, objectIds) => {
    void _projectId;
    updateState((current) => {
      const nextObjects: VoxelObject[] = [];
      for (const objectId of objectIds) {
        const obj = current.objects.find((o) => o.id === objectId);
        if (obj) {
          nextObjects.push(obj);
        }
      }
      current.objects.forEach((obj) => {
        if (!nextObjects.includes(obj)) {
          nextObjects.push(obj);
        }
      });
      current.objects = nextObjects.map((obj, index) => ({
        ...obj,
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
    objectIndex
  ) => {
    void _projectId;
    updateState((current) => {
      const obj = getObjectByIndex(objectIndex);
      if (!obj || obj.locked) return;

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
            const chunk = getOrCreateChunk(obj.id, {
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
