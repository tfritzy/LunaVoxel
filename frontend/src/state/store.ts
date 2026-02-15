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
import type { VoxelFrame } from "@/modeling/lib/voxel-frame";

export type GlobalState = {
  project: Project;
  objects: VoxelObject[];
  blocks: ProjectBlocks;
  chunks: Map<string, ChunkData>;
};

export type Reducers = {
  addObject: (projectId: string) => void;
  deleteObject: (objectId: string) => void;
  renameObject: (objectId: string, name: string) => void;
  toggleObjectVisibility: (objectId: string) => void;
  toggleObjectLock: (objectId: string) => void;
  reorderObjects: (projectId: string, objectIds: string[]) => void;
  applyFrame: (
    mode: BlockModificationMode,
    blockType: number,
    frame: VoxelFrame,
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
  selectAllVoxels?: (projectId: string, objectIndex: number) => void;
  deleteSelectedVoxels?: (projectId: string, objectIndex: number) => void;
  updateBlockColor: (blockIndex: number, color: number) => void;
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

  const DEFAULT_BLOCK_COLOR = 0x3d3852;
  const blocks: ProjectBlocks = {
    projectId,
    colors: Array.from({ length: 127 }, () => DEFAULT_BLOCK_COLOR),
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
const selectedVoxelsByObject = new Map<number, Uint8Array>();

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

const getWorldIndex = (x: number, y: number, z: number, dimensions: Vector3): number =>
  x * dimensions.y * dimensions.z + y * dimensions.z + z;

const getObjectVoxelAt = (objectId: string, x: number, y: number, z: number): number => {
  if (
    x < 0 ||
    y < 0 ||
    z < 0 ||
    x >= state.project.dimensions.x ||
    y >= state.project.dimensions.y ||
    z >= state.project.dimensions.z
  ) {
    return 0;
  }

  const minPos = {
    x: Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE,
    y: Math.floor(y / CHUNK_SIZE) * CHUNK_SIZE,
    z: Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE,
  };
  const key = getChunkKey(objectId, minPos);
  const chunk = state.chunks.get(key);
  if (!chunk) return 0;

  const localX = x - minPos.x;
  const localY = y - minPos.y;
  const localZ = z - minPos.z;
  const index =
    localX * chunk.size.y * chunk.size.z +
    localY * chunk.size.z +
    localZ;
  return chunk.voxels[index] ?? 0;
};

const reducers: Reducers = {
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
  renameObject: (objectId, name) => {
    updateState((current) => {
      const obj = current.objects.find((o) => o.id === objectId);
      if (obj) {
        obj.name = name;
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
  applyFrame: (
    mode,
    blockType,
    frame,
    objectIndex
  ) => {
    updateState(() => {
      const obj = getObjectByIndex(objectIndex);
      if (!obj || obj.locked) return;

      const frameDims = frame.getDimensions();
      const frameMin = frame.getMinPos();
      const minX = frameMin.x;
      const minY = frameMin.y;
      const minZ = frameMin.z;
      const maxX = minX + frameDims.x - 1;
      const maxY = minY + frameDims.y - 1;
      const maxZ = minZ + frameDims.z - 1;

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
                  const worldX = chunkX + x;
                  const worldY = chunkY + y;
                  const worldZ = chunkZ + z;
                  if (frame.get(worldX, worldY, worldZ) !== 0) {
                    applyBlockAt(chunk, mode, x, y, z, blockType);
                  }
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
  magicSelect: (_projectId, objectIndex, pos) => {
    void _projectId;
    const obj = getObjectByIndex(objectIndex);
    if (!obj) return;

    const seedValue = getObjectVoxelAt(
      obj.id,
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    );

    if (seedValue === 0) {
      selectedVoxelsByObject.delete(objectIndex);
      notify();
      return;
    }

    const { x: maxX, y: maxY, z: maxZ } = state.project.dimensions;
    const totalVoxels = maxX * maxY * maxZ;
    const selected = new Uint8Array(totalVoxels);
    const visited = new Uint8Array(totalVoxels);
    const queue: Vector3[] = [
      { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) },
    ];
    const directions = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ];

    while (queue.length > 0) {
      const current = queue.shift() as Vector3;
      const worldIndex = getWorldIndex(
        current.x,
        current.y,
        current.z,
        state.project.dimensions
      );
      if (visited[worldIndex]) continue;
      visited[worldIndex] = 1;

      if (getObjectVoxelAt(obj.id, current.x, current.y, current.z) !== seedValue) {
        continue;
      }

      selected[worldIndex] = 1;

      for (const direction of directions) {
        const nextX = current.x + direction.x;
        const nextY = current.y + direction.y;
        const nextZ = current.z + direction.z;
        if (
          nextX >= 0 &&
          nextY >= 0 &&
          nextZ >= 0 &&
          nextX < maxX &&
          nextY < maxY &&
          nextZ < maxZ
        ) {
          queue.push({ x: nextX, y: nextY, z: nextZ });
        }
      }
    }

    selectedVoxelsByObject.set(objectIndex, selected);
    notify();
  },
  commitSelectionMove: () => {},
  selectAllVoxels: (_projectId, objectIndex) => {
    void _projectId;
    const obj = getObjectByIndex(objectIndex);
    if (!obj) return;

    const totalVoxels =
      state.project.dimensions.x *
      state.project.dimensions.y *
      state.project.dimensions.z;
    const selected = new Uint8Array(totalVoxels);

    for (const chunk of state.chunks.values()) {
      if (chunk.objectId !== obj.id) continue;

      for (let localX = 0; localX < chunk.size.x; localX++) {
        for (let localY = 0; localY < chunk.size.y; localY++) {
          for (let localZ = 0; localZ < chunk.size.z; localZ++) {
            const localIndex =
              localX * chunk.size.y * chunk.size.z +
              localY * chunk.size.z +
              localZ;
            if (chunk.voxels[localIndex] === 0) continue;

            const worldX = chunk.minPos.x + localX;
            const worldY = chunk.minPos.y + localY;
            const worldZ = chunk.minPos.z + localZ;
            selected[getWorldIndex(worldX, worldY, worldZ, state.project.dimensions)] = 1;
          }
        }
      }
    }

    selectedVoxelsByObject.set(objectIndex, selected);
    notify();
  },
  deleteSelectedVoxels: (_projectId, objectIndex) => {
    void _projectId;
    const obj = getObjectByIndex(objectIndex);
    const selected = selectedVoxelsByObject.get(objectIndex);
    if (!obj || !selected) return;

    updateState((current) => {
      for (const chunk of current.chunks.values()) {
        if (chunk.objectId !== obj.id) continue;

        for (let localX = 0; localX < chunk.size.x; localX++) {
          for (let localY = 0; localY < chunk.size.y; localY++) {
            for (let localZ = 0; localZ < chunk.size.z; localZ++) {
              const worldX = chunk.minPos.x + localX;
              const worldY = chunk.minPos.y + localY;
              const worldZ = chunk.minPos.z + localZ;
              const worldIndex = getWorldIndex(
                worldX,
                worldY,
                worldZ,
                current.project.dimensions
              );

              if (selected[worldIndex]) {
                const localIndex =
                  localX * chunk.size.y * chunk.size.z +
                  localY * chunk.size.z +
                  localZ;
                chunk.voxels[localIndex] = 0;
              }
            }
          }
        }
      }
      selectedVoxelsByObject.delete(objectIndex);
    });
  },
  updateBlockColor: (blockIndex: number, color: number) => {
    updateState((current) => {
      if (blockIndex >= 0 && blockIndex < current.blocks.colors.length) {
        const nextColors = [...current.blocks.colors];
        nextColors[blockIndex] = color;
        current.blocks = {
          ...current.blocks,
          colors: nextColors,
        };
      }
    });
  },
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
  selectedVoxelsByObject.clear();
  notify();
};
