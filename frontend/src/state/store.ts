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
import { VoxelFrame } from "@/modeling/lib/voxel-frame";
import { colorPalettes, EMPTY_COLOR } from "@/components/custom/colorPalettes";

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
  selectAllVoxels: (projectId: string, objectIndex: number) => void;
  deleteSelectedVoxels: (projectId: string, objectIndex: number) => void;
  updateBlockColor: (blockIndex: number, color: number) => void;
  setBlockColors: (colors: number[]) => void;
  restoreObject: (
    object: VoxelObject,
    atIndex: number,
    chunks: Map<string, { key: string; minPos: Vector3; size: Vector3; voxels: Uint8Array }>
  ) => void;
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

const getSelectionChunkKey = (minPos: Vector3) =>
  `${minPos.x},${minPos.y},${minPos.z}`;

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
    selection: new VoxelFrame({ x: 0, y: 0, z: 0 }),
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
      selection: null,
    },
  ];

  const DEFAULT_PALETTE = colorPalettes[0];
  const blocks: ProjectBlocks = {
    projectId,
    colors: Array.from({ length: 127 }, (_, i) =>
      i < DEFAULT_PALETTE.colors.length ? DEFAULT_PALETTE.colors[i] : EMPTY_COLOR
    ),
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

const rebuildSelectionChunks = () => {
  const positionSelections = new Map<string, VoxelFrame>();

  for (const obj of state.objects) {
    if (!obj.selection || !obj.visible) continue;

    const sel = obj.selection;
    const selDims = sel.getDimensions();
    const selMin = sel.getMinPos();
    const dims = state.project.dimensions;

    for (let lx = 0; lx < selDims.x; lx++) {
      const wx = selMin.x + lx;
      if (wx < 0 || wx >= dims.x) continue;
      for (let ly = 0; ly < selDims.y; ly++) {
        const wy = selMin.y + ly;
        if (wy < 0 || wy >= dims.y) continue;
        for (let lz = 0; lz < selDims.z; lz++) {
          const wz = selMin.z + lz;
          if (wz < 0 || wz >= dims.z) continue;
          const val = sel.get(wx, wy, wz);
          if (val === 0) continue;

          const cx = Math.floor(wx / CHUNK_SIZE) * CHUNK_SIZE;
          const cy = Math.floor(wy / CHUNK_SIZE) * CHUNK_SIZE;
          const cz = Math.floor(wz / CHUNK_SIZE) * CHUNK_SIZE;
          const posKey = getSelectionChunkKey({ x: cx, y: cy, z: cz });

          let frame = positionSelections.get(posKey);
          if (!frame) {
            const size = {
              x: Math.min(CHUNK_SIZE, dims.x - cx),
              y: Math.min(CHUNK_SIZE, dims.y - cy),
              z: Math.min(CHUNK_SIZE, dims.z - cz),
            };
            frame = new VoxelFrame(size);
            positionSelections.set(posKey, frame);
          }

          const localX = wx - cx;
          const localY = wy - cy;
          const localZ = wz - cz;
          const frameDims = frame.getDimensions();
          frame.setByIndex(localX * frameDims.y * frameDims.z + localY * frameDims.z + localZ, val);
        }
      }
    }
  }

  for (const chunk of state.chunks.values()) {
    const posKey = getSelectionChunkKey(chunk.minPos);
    const frame = positionSelections.get(posKey);
    if (frame) {
      chunk.selection = frame;
    } else if (!chunk.selection.isEmpty()) {
      chunk.selection = new VoxelFrame({ x: 0, y: 0, z: 0 });
    }
  }
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
        selection: null,
      });
    });
  },
  deleteObject: (objectId) => {
    updateState((current) => {
      const target = current.objects.find((obj) => obj.id === objectId);
      if (!target) return;
      const hadSelection = target.selection !== null;
      current.objects = current.objects
        .filter((obj) => obj.id !== objectId)
        .map((obj, index) => ({ ...obj, index }));

      for (const [key, chunk] of current.chunks.entries()) {
        if (chunk.objectId === objectId) {
          current.chunks.delete(key);
        }
      }

      if (hadSelection) {
        rebuildSelectionChunks();
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
        if (obj.selection) {
          rebuildSelectionChunks();
        }
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
  undoEdit: (_projectId, beforeDiff, afterDiff, objectIndex) => {
    updateState((current) => {
      const obj = getObjectByIndex(objectIndex);
      if (!obj) return;

      const dims = current.project.dimensions;
      const yz = dims.y * dims.z;

      for (let i = 0; i < beforeDiff.length; i++) {
        if (beforeDiff[i] === 0 && afterDiff[i] === 0) continue;

        const x = Math.floor(i / yz);
        const remainder = i % yz;
        const y = Math.floor(remainder / dims.z);
        const z = remainder % dims.z;

        const cx = Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE;
        const cy = Math.floor(y / CHUNK_SIZE) * CHUNK_SIZE;
        const cz = Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE;

        const chunk = getOrCreateChunk(obj.id, { x: cx, y: cy, z: cz });
        const lx = x - cx;
        const ly = y - cy;
        const lz = z - cz;
        const ci = lx * chunk.size.y * chunk.size.z + ly * chunk.size.z + lz;
        chunk.voxels[ci] = beforeDiff[i];
      }
    });
  },
  updateCursorPos: () => {},
  magicSelect: () => {},
  commitSelectionMove: () => {},
  selectAllVoxels: (_projectId, objectIndex) => {
    const obj = getObjectByIndex(objectIndex);
    if (!obj) return;

    const dims = state.project.dimensions;
    const total = dims.x * dims.y * dims.z;
    const buf = new Uint8Array(total);
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -1, maxY = -1, maxZ = -1;

    for (const chunk of state.chunks.values()) {
      if (chunk.objectId !== obj.id) continue;
      for (let lx = 0; lx < chunk.size.x; lx++) {
        for (let ly = 0; ly < chunk.size.y; ly++) {
          for (let lz = 0; lz < chunk.size.z; lz++) {
            if (chunk.voxels[lx * chunk.size.y * chunk.size.z + ly * chunk.size.z + lz] === 0) continue;
            const wx = chunk.minPos.x + lx;
            const wy = chunk.minPos.y + ly;
            const wz = chunk.minPos.z + lz;
            buf[wx * dims.y * dims.z + wy * dims.z + wz] = 1;
            if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
            if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
            if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
          }
        }
      }
    }

    if (maxX < 0) {
      obj.selection = null;
      rebuildSelectionChunks();
      notify();
      return;
    }

    const sdx = maxX - minX + 1, sdy = maxY - minY + 1, sdz = maxZ - minZ + 1;
    const frameData = new Uint8Array(sdx * sdy * sdz);
    for (let wx = minX; wx <= maxX; wx++) {
      for (let wy = minY; wy <= maxY; wy++) {
        for (let wz = minZ; wz <= maxZ; wz++) {
          if (buf[wx * dims.y * dims.z + wy * dims.z + wz] === 0) continue;
          frameData[(wx - minX) * sdy * sdz + (wy - minY) * sdz + (wz - minZ)] = 1;
        }
      }
    }

    obj.selection = new VoxelFrame({ x: sdx, y: sdy, z: sdz }, { x: minX, y: minY, z: minZ }, frameData);
    rebuildSelectionChunks();
    notify();
  },
  deleteSelectedVoxels: (_projectId, objectIndex) => {
    const obj = getObjectByIndex(objectIndex);
    if (!obj || !obj.selection) return;

    const sel = obj.selection;
    const selDims = sel.getDimensions();
    const selMin = sel.getMinPos();

    updateState((current) => {
      const chunkCache = new Map<string, ChunkData | undefined>();
      for (let lx = 0; lx < selDims.x; lx++) {
        for (let ly = 0; ly < selDims.y; ly++) {
          for (let lz = 0; lz < selDims.z; lz++) {
            if (sel.get(selMin.x + lx, selMin.y + ly, selMin.z + lz) === 0) continue;
            const wx = selMin.x + lx, wy = selMin.y + ly, wz = selMin.z + lz;
            const cx = Math.floor(wx / CHUNK_SIZE) * CHUNK_SIZE;
            const cy = Math.floor(wy / CHUNK_SIZE) * CHUNK_SIZE;
            const cz = Math.floor(wz / CHUNK_SIZE) * CHUNK_SIZE;
            const key = getChunkKey(obj.id, { x: cx, y: cy, z: cz });
            if (!chunkCache.has(key)) chunkCache.set(key, current.chunks.get(key));
            const chunk = chunkCache.get(key);
            if (!chunk) continue;
            const ci = (wx - cx) * chunk.size.y * chunk.size.z + (wy - cy) * chunk.size.z + (wz - cz);
            chunk.voxels[ci] = 0;
          }
        }
      }
      obj.selection = null;
      rebuildSelectionChunks();
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
  setBlockColors: (colors: number[]) => {
    updateState((current) => {
      const total = current.blocks.colors.length;
      const nextColors = Array.from({ length: total }, (_, i) =>
        i < colors.length ? colors[i] : EMPTY_COLOR
      );
      current.blocks = {
        ...current.blocks,
        colors: nextColors,
      };
    });
  },
  restoreObject: (object, atIndex, chunks) => {
    updateState((current) => {
      const restored: VoxelObject = {
        ...object,
        index: atIndex,
        selection: null,
      };
      current.objects.splice(atIndex, 0, restored);
      current.objects = current.objects.map((obj, i) => ({ ...obj, index: i }));

      for (const [key, chunkData] of chunks.entries()) {
        current.chunks.set(key, {
          key: chunkData.key,
          projectId: current.project.id,
          objectId: object.id,
          minPos: { ...chunkData.minPos },
          size: { ...chunkData.size },
          voxels: new Uint8Array(chunkData.voxels),
        });
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
  notify();
};
