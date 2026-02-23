import * as THREE from "three";
import type { BlockModificationMode } from "@/state/types";
import type { ToolType } from "../tool-type";
import type { Tool, ToolOption, ToolContext, ToolMouseEvent, ToolDragEvent } from "../tool-interface";
import { getActiveObject } from "../tool-interface";
import { calculateGridPositionWithMode } from "./tool-utils";
import { RAYCASTABLE_BIT } from "../voxel-constants";
import { getBlockType } from "../voxel-data-utils";
import { VoxelFrame } from "../voxel-frame";

export type FillMode = "Flood" | "Shell" | "Coat";

const NEIGHBORS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

export class FillTool implements Tool {
  private enabledDirections = new Set(["+x", "-x", "+y", "-y", "+z", "-z"]);
  private fillMode: FillMode = "Flood";
  private shellWidth: number = 1;
  private layerWidth: number = 1;

  getType(): ToolType {
    return "Fill";
  }

  getOptions(): ToolOption[] {
    const options: ToolOption[] = [
      {
        name: "Fill Mode",
        values: ["Flood", "Shell", "Coat"],
        currentValue: this.fillMode,
      },
    ];

    if (this.fillMode === "Flood") {
      options.push({
        name: "Fill Direction",
        values: ["+x", "+y", "+z", "-x", "-y", "-z"],
        currentValue: [...this.enabledDirections].join(","),
        type: "multi-direction",
      });
    } else if (this.fillMode === "Shell") {
      options.push({
        name: "Shell Width",
        values: [],
        currentValue: String(this.shellWidth),
        type: "slider",
        min: 1,
        max: 10,
      });
    } else if (this.fillMode === "Coat") {
      options.push({
        name: "Layer Width",
        values: [],
        currentValue: String(this.layerWidth),
        type: "slider",
        min: 1,
        max: 10,
      });
    }

    return options;
  }

  setOption(name: string, value: string): void {
    if (name === "Fill Direction") {
      this.enabledDirections = new Set(value.split(",").filter(Boolean));
    } else if (name === "Fill Mode") {
      this.fillMode = value as FillMode;
    } else if (name === "Shell Width") {
      this.shellWidth = parseInt(value, 10);
    } else if (name === "Layer Width") {
      this.layerWidth = parseInt(value, 10);
    }
  }

  calculateGridPosition(
    gridPosition: THREE.Vector3,
    normal: THREE.Vector3,
    mode?: BlockModificationMode
  ): THREE.Vector3 {
    void mode;
    return calculateGridPositionWithMode(gridPosition, normal, "under");
  }

  private getBlockValue(mode: BlockModificationMode, selectedBlock: number): number {
    switch (mode.tag) {
      case "Attach":
        return selectedBlock;
      case "Paint":
        return selectedBlock | RAYCASTABLE_BIT;
      case "Erase":
        return RAYCASTABLE_BIT;
    }
  }

  onMouseDown(context: ToolContext, event: ToolMouseEvent): void {
    const obj = getActiveObject(context);
    if (!obj) return;

    const pos = event.gridPosition;
    const dims = obj.dimensions;

    if (pos.x < 0 || pos.x >= dims.x || pos.y < 0 || pos.y >= dims.y || pos.z < 0 || pos.z >= dims.z) return;

    const clickedBlock = context.projectManager.getBlockAtPosition(pos, obj.id);
    if (clickedBlock === null || clickedBlock === 0) return;

    const targetType = getBlockType(clickedBlock);
    if (targetType === 0) return;

    const blockValue = this.getBlockValue(context.mode, context.selectedBlock);
    const dimY = dims.y;
    const dimZ = dims.z;

    const totalSize = dims.x * dimY * dimZ;
    const visited = new Uint8Array(totalSize);
    const queue: number[] = [];

    const startIndex = pos.x * dimY * dimZ + pos.y * dimZ + pos.z;
    visited[startIndex] = 1;
    queue.push(pos.x, pos.y, pos.z);

    const tmpVec = new THREE.Vector3();

    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];

      for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) continue;

        const nIndex = nx * dimY * dimZ + ny * dimZ + nz;
        if (visited[nIndex]) continue;
        visited[nIndex] = 1;

        const neighborBlock = context.projectManager.getBlockAtPosition(
          tmpVec.set(nx, ny, nz), obj.id
        );

        if (neighborBlock !== null && getBlockType(neighborBlock) === targetType) {
          queue.push(nx, ny, nz);
        }
      }
    }

    // Build a region membership array from the queue (queue contains only matching blocks)
    const inRegion = new Uint8Array(totalSize);
    for (let i = 0; i < queue.length; i += 3) {
      inRegion[queue[i] * dimY * dimZ + queue[i + 1] * dimZ + queue[i + 2]] = 1;
    }

    const selectionFrame = context.stateStore.getState().voxelSelection;

    if (this.fillMode === "Shell") {
      this.applyShell(context, queue, inRegion, dims, blockValue, selectionFrame, this.shellWidth);
    } else if (this.fillMode === "Coat") {
      this.applyCoat(context, queue, inRegion, dims, blockValue, selectionFrame, this.layerWidth);
    } else {
      this.applyFlood(context, queue, dims, blockValue, selectionFrame, pos);
    }
  }

  private applyFlood(
    context: ToolContext,
    queue: number[],
    dims: { x: number; y: number; z: number },
    blockValue: number,
    selectionFrame: VoxelFrame | null,
    startPos: THREE.Vector3
  ): void {
    const obj = getActiveObject(context)!;
    const startX = startPos.x, startY = startPos.y, startZ = startPos.z;
    const dirPX = this.enabledDirections.has("+x");
    const dirNX = this.enabledDirections.has("-x");
    const dirPY = this.enabledDirections.has("+y");
    const dirNY = this.enabledDirections.has("-y");
    const dirPZ = this.enabledDirections.has("+z");
    const dirNZ = this.enabledDirections.has("-z");

    let minX = startPos.x, maxX = startPos.x;
    let minY = startPos.y, maxY = startPos.y;
    let minZ = startPos.z, maxZ = startPos.z;

    const toWrite: [number, number, number][] = [];

    for (let i = 0; i < queue.length; i += 3) {
      const x = queue[i], y = queue[i + 1], z = queue[i + 2];

      if ((!dirPX && x > startX) || (!dirNX && x < startX) ||
          (!dirPY && y > startY) || (!dirNY && y < startY) ||
          (!dirPZ && z > startZ) || (!dirNZ && z < startZ)) continue;

      if (selectionFrame && !selectionFrame.isSet(x, y, z)) continue;

      toWrite.push([x, y, z]);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    if (toWrite.length === 0) return;

    const frameDims = { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 };
    const frame = new VoxelFrame(frameDims, { x: minX, y: minY, z: minZ });
    for (const [x, y, z] of toWrite) {
      frame.set(x, y, z, blockValue);
    }

    context.reducers.applyFrame(context.mode, context.selectedBlock, frame, obj.id);
  }

  private applyShell(
    context: ToolContext,
    queue: number[],
    inRegion: Uint8Array,
    dims: { x: number; y: number; z: number },
    blockValue: number,
    selectionFrame: VoxelFrame | null,
    shellWidth: number
  ): void {
    const obj = getActiveObject(context)!;
    const dimY = dims.y, dimZ = dims.z;

    // shellDist[i] = 0: not yet assigned; >0: shell layer distance from boundary
    const shellDist = new Uint8Array(inRegion.length);
    const shellQueue: number[] = [];

    // Boundary blocks touch either the world edge or an empty neighbor
    for (let i = 0; i < queue.length; i += 3) {
      const x = queue[i], y = queue[i + 1], z = queue[i + 2];
      const idx = x * dimY * dimZ + y * dimZ + z;

      let isBoundary = false;
      for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) {
          isBoundary = true;
          break;
        }
        if (!inRegion[nx * dimY * dimZ + ny * dimZ + nz]) {
          isBoundary = true;
          break;
        }
      }

      if (isBoundary) {
        shellDist[idx] = 1;
        shellQueue.push(x, y, z);
      }
    }

    // BFS inward through the region to expand shell up to shellWidth layers
    let head = 0;
    while (head < shellQueue.length) {
      const x = shellQueue[head++], y = shellQueue[head++], z = shellQueue[head++];
      const dist = shellDist[x * dimY * dimZ + y * dimZ + z];
      if (dist >= shellWidth) continue;

      for (const [dx, dy, dz] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) continue;

        const nIdx = nx * dimY * dimZ + ny * dimZ + nz;
        if (!inRegion[nIdx] || shellDist[nIdx] !== 0) continue;

        shellDist[nIdx] = dist + 1;
        shellQueue.push(nx, ny, nz);
      }
    }

    const toWrite: [number, number, number][] = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < shellQueue.length; i += 3) {
      const x = shellQueue[i], y = shellQueue[i + 1], z = shellQueue[i + 2];
      if (selectionFrame && !selectionFrame.isSet(x, y, z)) continue;
      toWrite.push([x, y, z]);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    if (toWrite.length === 0) return;

    const frameDims = { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 };
    const frame = new VoxelFrame(frameDims, { x: minX, y: minY, z: minZ });
    for (const [x, y, z] of toWrite) {
      frame.set(x, y, z, blockValue);
    }

    context.reducers.applyFrame(context.mode, context.selectedBlock, frame, obj.id);
  }

  private applyCoat(
    context: ToolContext,
    queue: number[],
    inRegion: Uint8Array,
    dims: { x: number; y: number; z: number },
    blockValue: number,
    selectionFrame: VoxelFrame | null,
    layerWidth: number
  ): void {
    const obj = getActiveObject(context)!;
    const dimY = dims.y, dimZ = dims.z;
    const isAttach = context.mode.tag === "Attach";

    const coatDist = new Uint8Array(dims.x * dimY * dimZ);
    const coatQueue: number[] = [];

    if (isAttach) {
      // Mark region cells as blocked so BFS won't enter them
      for (let i = 0; i < inRegion.length; i++) {
        if (inRegion[i]) coatDist[i] = 0xff;
      }

      // Layer 1: in-bounds empty cells adjacent to solid region blocks
      for (let i = 0; i < queue.length; i += 3) {
        const x = queue[i], y = queue[i + 1], z = queue[i + 2];
        for (const [dx, dy, dz] of NEIGHBORS) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) continue;
          const nIdx = nx * dimY * dimZ + ny * dimZ + nz;
          if (coatDist[nIdx] !== 0) continue;
          coatDist[nIdx] = 1;
          coatQueue.push(nx, ny, nz);
        }
      }

      // BFS outward through empty space up to layerWidth
      let head = 0;
      while (head < coatQueue.length) {
        const x = coatQueue[head++], y = coatQueue[head++], z = coatQueue[head++];
        const dist = coatDist[x * dimY * dimZ + y * dimZ + z];
        if (dist >= layerWidth) continue;

        for (const [dx, dy, dz] of NEIGHBORS) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) continue;
          const nIdx = nx * dimY * dimZ + ny * dimZ + nz;
          if (coatDist[nIdx] !== 0) continue;
          coatDist[nIdx] = dist + 1;
          coatQueue.push(nx, ny, nz);
        }
      }
    } else {
      // Erase/Paint: find surface blocks — region blocks adjacent to in-bounds empty cells
      // World boundary is treated as solid (not a surface trigger)
      for (let i = 0; i < queue.length; i += 3) {
        const x = queue[i], y = queue[i + 1], z = queue[i + 2];
        const idx = x * dimY * dimZ + y * dimZ + z;

        let isSurface = false;
        for (const [dx, dy, dz] of NEIGHBORS) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) continue;
          if (!inRegion[nx * dimY * dimZ + ny * dimZ + nz]) {
            isSurface = true;
            break;
          }
        }

        if (isSurface) {
          coatDist[idx] = 1;
          coatQueue.push(x, y, z);
        }
      }

      // BFS inward through region up to layerWidth
      let head = 0;
      while (head < coatQueue.length) {
        const x = coatQueue[head++], y = coatQueue[head++], z = coatQueue[head++];
        const dist = coatDist[x * dimY * dimZ + y * dimZ + z];
        if (dist >= layerWidth) continue;

        for (const [dx, dy, dz] of NEIGHBORS) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx < 0 || nx >= dims.x || ny < 0 || ny >= dimY || nz < 0 || nz >= dimZ) continue;
          const nIdx = nx * dimY * dimZ + ny * dimZ + nz;
          if (!inRegion[nIdx] || coatDist[nIdx] !== 0) continue;
          coatDist[nIdx] = dist + 1;
          coatQueue.push(nx, ny, nz);
        }
      }
    }

    const toWrite: [number, number, number][] = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < coatQueue.length; i += 3) {
      const x = coatQueue[i], y = coatQueue[i + 1], z = coatQueue[i + 2];
      if (selectionFrame && !selectionFrame.isSet(x, y, z)) continue;
      toWrite.push([x, y, z]);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    if (toWrite.length === 0) return;

    const frameDims = { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 };
    const frame = new VoxelFrame(frameDims, { x: minX, y: minY, z: minZ });
    for (const [x, y, z] of toWrite) {
      frame.set(x, y, z, blockValue);
    }

    context.reducers.applyFrame(context.mode, context.selectedBlock, frame, obj.id);
  }

  onDrag(context: ToolContext, event: ToolDragEvent): void {
    void context;
    void event;
  }

  onMouseUp(context: ToolContext, event: ToolDragEvent): void {
    void context;
    void event;
  }
}
