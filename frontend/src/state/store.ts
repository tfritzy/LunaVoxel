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
import { BLOCK_TYPE_MASK, RAYCASTABLE_BIT } from "@/modeling/lib/voxel-constants";
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
  moveSelection: (projectId: string, offset: Vector3) => void;
  moveObject: (projectId: string, objectIndex: number, offset: Vector3) => void;
  beginSelectionMove: (projectId: string) => void;
  commitSelectionMove: (projectId: string) => void;
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

const createChunkData = (
  projectId: string,
  objectId: string,
  minPos: Vector3,
  objectDimensions: Vector3
): ChunkData => {
  const size = {
    x: Math.min(CHUNK_SIZE, objectDimensions.x - minPos.x),
    y: Math.min(CHUNK_SIZE, objectDimensions.y - minPos.y),
    z: Math.min(CHUNK_SIZE, objectDimensions.z - minPos.z),
  };
  const voxels = new Uint8Array(size.x * size.y * size.z);
  return {
    key: getChunkKey(objectId, minPos),
    projectId,
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
  const seedChunk = createChunkData(projectId, objectId, { x: 0, y: 0, z: 0 }, objects[0].dimensions);

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

type EditHistoryHandle = {
  addEntry: (previous: Uint8Array, updated: Uint8Array, object: number) => void;
};

let editHistoryRef: EditHistoryHandle | null = null;
let selectionMoveSnapshot: { objectIndex: number; data: Uint8Array } | null = null;

export function registerEditHistory(history: EditHistoryHandle) {
  editHistoryRef = history;
}

function snapshotObjectVoxels(objectIndex: number): Uint8Array {
  const obj = state.objects.find((o) => o.index === objectIndex);
  if (!obj) return new Uint8Array(0);

  const dims = obj.dimensions;
  const total = dims.x * dims.y * dims.z;
  const snapshot = new Uint8Array(total);

  for (const chunk of state.chunks.values()) {
    if (chunk.objectId !== obj.id) continue;
    const { size, minPos, voxels } = chunk;
    const syz = size.y * size.z;
    for (let lx = 0; lx < size.x; lx++) {
      const wx = minPos.x + lx;
      for (let ly = 0; ly < size.y; ly++) {
        const wy = minPos.y + ly;
        for (let lz = 0; lz < size.z; lz++) {
          const val = voxels[lx * syz + ly * size.z + lz];
          if (val !== 0) {
            const wz = minPos.z + lz;
            snapshot[wx * dims.y * dims.z + wy * dims.z + wz] = val;
          }
        }
      }
    }
  }

  return snapshot;
}

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
    const obj = state.objects.find((o) => o.id === objectId);
    const dims = obj ? obj.dimensions : state.project.dimensions;
    chunk = createChunkData(state.project.id, objectId, minPos, dims);
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
  addObject: (_projectId) => {
    void _projectId;
    updateState((current) => {
      const nextIndex = current.objects.length;
      current.objects = [
        ...current.objects,
        {
          id: createId(),
          projectId: current.project.id,
          index: nextIndex,
          name: `Object ${nextIndex + 1}`,
          visible: true,
          locked: false,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { x: 64, y: 64, z: 64 },
          selection: null,
        },
      ];
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
    const before = editHistoryRef ? snapshotObjectVoxels(objectIndex) : null;
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
    if (before) {
      const after = snapshotObjectVoxels(objectIndex);
      editHistoryRef!.addEntry(before, after, objectIndex);
    }
  },
  undoEdit: (_projectId, beforeDiff, afterDiff, objectIndex) => {
    updateState((current) => {
      const obj = getObjectByIndex(objectIndex);
      if (!obj) return;

      const dims = obj.dimensions;
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
  magicSelect: (_projectId, objectIndex, pos) => {
    const obj = getObjectByIndex(objectIndex);
    if (!obj) return;

    const dims = obj.dimensions;

    const getBlock = (wx: number, wy: number, wz: number): number => {
      const cx = Math.floor(wx / CHUNK_SIZE) * CHUNK_SIZE;
      const cy = Math.floor(wy / CHUNK_SIZE) * CHUNK_SIZE;
      const cz = Math.floor(wz / CHUNK_SIZE) * CHUNK_SIZE;
      const key = getChunkKey(obj.id, { x: cx, y: cy, z: cz });
      const chunk = state.chunks.get(key);
      if (!chunk) return 0;
      const lx = wx - cx;
      const ly = wy - cy;
      const lz = wz - cz;
      return chunk.voxels[lx * chunk.size.y * chunk.size.z + ly * chunk.size.z + lz];
    };

    const startBlock = getBlock(pos.x, pos.y, pos.z) & BLOCK_TYPE_MASK;
    if (startBlock === 0) {
      obj.selection = null;
      notify();
      return;
    }

    const total = dims.x * dims.y * dims.z;
    const yz = dims.y * dims.z;
    const visited = new Uint8Array(total);
    const selected = new Uint8Array(total);
    let minX = pos.x, minY = pos.y, minZ = pos.z;
    let maxX = pos.x, maxY = pos.y, maxZ = pos.z;

    const queue: number[] = [pos.x * yz + pos.y * dims.z + pos.z];
    visited[queue[0]] = 1;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      const wx = Math.floor(idx / yz);
      const remainder = idx % yz;
      const wy = Math.floor(remainder / dims.z);
      const wz = remainder % dims.z;

      selected[idx] = 1;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;

      const neighbors = [
        [wx + 1, wy, wz], [wx - 1, wy, wz],
        [wx, wy + 1, wz], [wx, wy - 1, wz],
        [wx, wy, wz + 1], [wx, wy, wz - 1],
      ];

      for (const [nx, ny, nz] of neighbors) {
        if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dims.y || nz < 0 || nz >= dims.z) continue;
        const ni = nx * yz + ny * dims.z + nz;
        if (visited[ni]) continue;
        visited[ni] = 1;
        if ((getBlock(nx, ny, nz) & BLOCK_TYPE_MASK) === startBlock) {
          queue.push(ni);
        }
      }
    }

    const sdx = maxX - minX + 1, sdy = maxY - minY + 1, sdz = maxZ - minZ + 1;
    const frameData = new Uint8Array(sdx * sdy * sdz);
    for (let wx = minX; wx <= maxX; wx++) {
      for (let wy = minY; wy <= maxY; wy++) {
        for (let wz = minZ; wz <= maxZ; wz++) {
          if (selected[wx * yz + wy * dims.z + wz] === 0) continue;
          frameData[(wx - minX) * sdy * sdz + (wy - minY) * sdz + (wz - minZ)] = 1;
        }
      }
    }

    obj.selection = new VoxelFrame({ x: sdx, y: sdy, z: sdz }, { x: minX, y: minY, z: minZ }, frameData);
    notify();
  },
  moveSelection: (_projectId, offset) => {
    const obj = state.objects.find((o) => o.selection !== null);
    if (!obj || !obj.selection) return;

    const sel = obj.selection;
    const selDims = sel.getDimensions();
    const selMin = sel.getMinPos();
    const dims = obj.dimensions;
    const wrap = (val: number, dim: number) => ((val % dim) + dim) % dim;

    const voxels: { wx: number; wy: number; wz: number; value: number }[] = [];
    const chunkCache = new Map<string, ChunkData | undefined>();

    const getChunkCached = (wx: number, wy: number, wz: number) => {
      const cx = Math.floor(wx / CHUNK_SIZE) * CHUNK_SIZE;
      const cy = Math.floor(wy / CHUNK_SIZE) * CHUNK_SIZE;
      const cz = Math.floor(wz / CHUNK_SIZE) * CHUNK_SIZE;
      const key = getChunkKey(obj.id, { x: cx, y: cy, z: cz });
      if (!chunkCache.has(key)) chunkCache.set(key, state.chunks.get(key));
      return { chunk: chunkCache.get(key), cx, cy, cz };
    };

    for (let lx = 0; lx < selDims.x; lx++) {
      for (let ly = 0; ly < selDims.y; ly++) {
        for (let lz = 0; lz < selDims.z; lz++) {
          const wx = selMin.x + lx;
          const wy = selMin.y + ly;
          const wz = selMin.z + lz;
          if (sel.get(wx, wy, wz) === 0) continue;

          const { chunk, cx, cy, cz } = getChunkCached(wx, wy, wz);
          if (!chunk) continue;
          const ci = (wx - cx) * chunk.size.y * chunk.size.z + (wy - cy) * chunk.size.z + (wz - cz);
          const value = chunk.voxels[ci];
          if (value === 0) continue;

          voxels.push({ wx, wy, wz, value });
          chunk.voxels[ci] = 0;
        }
      }
    }

    chunkCache.clear();

    for (const { wx, wy, wz, value } of voxels) {
      const nx = wrap(wx + offset.x, dims.x);
      const ny = wrap(wy + offset.y, dims.y);
      const nz = wrap(wz + offset.z, dims.z);

      const cx = Math.floor(nx / CHUNK_SIZE) * CHUNK_SIZE;
      const cy = Math.floor(ny / CHUNK_SIZE) * CHUNK_SIZE;
      const cz = Math.floor(nz / CHUNK_SIZE) * CHUNK_SIZE;
      const chunk = getOrCreateChunk(obj.id, { x: cx, y: cy, z: cz });
      const ci = (nx - cx) * chunk.size.y * chunk.size.z + (ny - cy) * chunk.size.z + (nz - cz);
      chunk.voxels[ci] = value;
    }

    let newMinX = Infinity, newMinY = Infinity, newMinZ = Infinity;
    let newMaxX = -1, newMaxY = -1, newMaxZ = -1;
    for (let lx = 0; lx < selDims.x; lx++) {
      for (let ly = 0; ly < selDims.y; ly++) {
        for (let lz = 0; lz < selDims.z; lz++) {
          if (sel.get(selMin.x + lx, selMin.y + ly, selMin.z + lz) === 0) continue;
          const nx = wrap(selMin.x + lx + offset.x, dims.x);
          const ny = wrap(selMin.y + ly + offset.y, dims.y);
          const nz = wrap(selMin.z + lz + offset.z, dims.z);
          if (nx < newMinX) newMinX = nx; if (nx > newMaxX) newMaxX = nx;
          if (ny < newMinY) newMinY = ny; if (ny > newMaxY) newMaxY = ny;
          if (nz < newMinZ) newMinZ = nz; if (nz > newMaxZ) newMaxZ = nz;
        }
      }
    }

    if (newMaxX >= 0) {
      const sdx = newMaxX - newMinX + 1;
      const sdy = newMaxY - newMinY + 1;
      const sdz = newMaxZ - newMinZ + 1;
      const frameData = new Uint8Array(sdx * sdy * sdz);
      for (let lx = 0; lx < selDims.x; lx++) {
        for (let ly = 0; ly < selDims.y; ly++) {
          for (let lz = 0; lz < selDims.z; lz++) {
            if (sel.get(selMin.x + lx, selMin.y + ly, selMin.z + lz) === 0) continue;
            const nx = wrap(selMin.x + lx + offset.x, dims.x);
            const ny = wrap(selMin.y + ly + offset.y, dims.y);
            const nz = wrap(selMin.z + lz + offset.z, dims.z);
            frameData[(nx - newMinX) * sdy * sdz + (ny - newMinY) * sdz + (nz - newMinZ)] = 1;
          }
        }
      }
      obj.selection = new VoxelFrame({ x: sdx, y: sdy, z: sdz }, { x: newMinX, y: newMinY, z: newMinZ }, frameData);
    } else {
      obj.selection = null;
    }

    notify();
  },
  moveObject: (_projectId, objectIndex, offset) => {
    const obj = getObjectByIndex(objectIndex);
    if (!obj) return;
    obj.position = {
      x: obj.position.x + offset.x,
      y: obj.position.y + offset.y,
      z: obj.position.z + offset.z,
    };
    notify();
  },
  beginSelectionMove: (_projectId) => {
    const obj = state.objects.find((o) => o.selection !== null);
    if (!obj || !editHistoryRef) {
      selectionMoveSnapshot = null;
      return;
    }
    selectionMoveSnapshot = {
      objectIndex: obj.index,
      data: snapshotObjectVoxels(obj.index),
    };
  },
  commitSelectionMove: (_projectId) => {
    if (!selectionMoveSnapshot || !editHistoryRef) {
      selectionMoveSnapshot = null;
      return;
    }
    const after = snapshotObjectVoxels(selectionMoveSnapshot.objectIndex);
    let hasChange = false;
    for (let i = 0; i < after.length; i++) {
      if (selectionMoveSnapshot.data[i] !== after[i]) {
        hasChange = true;
        break;
      }
    }
    if (hasChange) {
      editHistoryRef.addEntry(selectionMoveSnapshot.data, after, selectionMoveSnapshot.objectIndex);
    }
    selectionMoveSnapshot = null;
  },
  selectAllVoxels: (_projectId, objectIndex) => {
    const obj = getObjectByIndex(objectIndex);
    if (!obj) return;

    const dims = obj.dimensions;
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
    notify();
  },
  deleteSelectedVoxels: (_projectId, objectIndex) => {
    const obj = getObjectByIndex(objectIndex);
    if (!obj || !obj.selection) return;

    const sel = obj.selection;
    const selDims = sel.getDimensions();
    const selMin = sel.getMinPos();

    const before = editHistoryRef ? snapshotObjectVoxels(objectIndex) : null;
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
    });
    if (before) {
      const after = snapshotObjectVoxels(objectIndex);
      editHistoryRef!.addEntry(before, after, objectIndex);
    }
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
  selectionMoveSnapshot = null;
  notify();
};
