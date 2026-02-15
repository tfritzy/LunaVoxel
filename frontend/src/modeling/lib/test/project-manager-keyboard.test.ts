import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import { ProjectManager } from "../project-manager";
import type { StateStore } from "@/state/store";

describe("ProjectManager keyboard shortcuts", () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("window", {
      addEventListener,
      removeEventListener,
    });
    addEventListener.mockClear();
    removeEventListener.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createProjectManager = (reducers: StateStore["reducers"]) => {
    const stateStore: StateStore = {
      getState: () => ({
        project: { id: "project-1", dimensions: { x: 8, y: 8, z: 8 } },
        objects: [
          {
            id: "obj-1",
            projectId: "project-1",
            index: 0,
            name: "Object 1",
            visible: true,
            locked: false,
            position: { x: 0, y: 0, z: 0 },
            dimensions: { x: 8, y: 8, z: 8 },
          },
        ],
        blocks: { projectId: "project-1", colors: [] },
        chunks: new Map(),
      }),
      subscribe: () => () => {},
      reducers,
    };

    const container = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      }),
    } as unknown as HTMLElement;

    const manager = new ProjectManager(
      new THREE.Scene(),
      stateStore,
      { id: "project-1", dimensions: { x: 8, y: 8, z: 8 } },
      new THREE.PerspectiveCamera(),
      container
    );

    return manager;
  };

  it("should trigger select-all reducer on Ctrl/Cmd+A", () => {
    const selectAllVoxels = vi.fn();
    const preventDefault = vi.fn();
    const manager = createProjectManager({
      addObject: vi.fn(),
      deleteObject: vi.fn(),
      renameObject: vi.fn(),
      toggleObjectVisibility: vi.fn(),
      toggleObjectLock: vi.fn(),
      reorderObjects: vi.fn(),
      applyFrame: vi.fn(),
      undoEdit: vi.fn(),
      updateCursorPos: vi.fn(),
      magicSelect: vi.fn(),
      commitSelectionMove: vi.fn(),
      selectAllVoxels,
      deleteSelectedVoxels: vi.fn(),
      updateBlockColor: vi.fn(),
    });

    const handler = addEventListener.mock.calls[0][1] as (event: KeyboardEvent) => void;
    manager.builder.setSelectedObject(3);

    handler(({
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      key: "a",
      preventDefault,
      target: null,
    } as unknown) as KeyboardEvent);

    expect(selectAllVoxels).toHaveBeenCalledWith("project-1", 3);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    manager.dispose();
  });

  it("should trigger delete-selected reducer on Delete", () => {
    const deleteSelectedVoxels = vi.fn();
    const preventDefault = vi.fn();
    const manager = createProjectManager({
      addObject: vi.fn(),
      deleteObject: vi.fn(),
      renameObject: vi.fn(),
      toggleObjectVisibility: vi.fn(),
      toggleObjectLock: vi.fn(),
      reorderObjects: vi.fn(),
      applyFrame: vi.fn(),
      undoEdit: vi.fn(),
      updateCursorPos: vi.fn(),
      magicSelect: vi.fn(),
      commitSelectionMove: vi.fn(),
      selectAllVoxels: vi.fn(),
      deleteSelectedVoxels,
      updateBlockColor: vi.fn(),
    });

    const handler = addEventListener.mock.calls[0][1] as (event: KeyboardEvent) => void;
    manager.builder.setSelectedObject(1);

    handler(({
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      key: "Delete",
      preventDefault,
      target: null,
    } as unknown) as KeyboardEvent);

    expect(deleteSelectedVoxels).toHaveBeenCalledWith("project-1", 1);
    expect(preventDefault).toHaveBeenCalledOnce();
    manager.dispose();
  });
});
