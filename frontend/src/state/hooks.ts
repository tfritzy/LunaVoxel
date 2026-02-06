import { useState, useEffect, useCallback, useMemo } from "react";
import { globalStore, type GlobalState } from "./store";
import type { Project, Layer, Chunk, Selection, AccessType } from "./types";
import { reducers } from "./reducers";

export function useGlobalState(): GlobalState {
  const [state, setState] = useState<GlobalState>(globalStore.getState());

  useEffect(() => {
    return globalStore.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}

export function useReducers() {
  return reducers;
}

export function useCurrentUserId(): string | null {
  const state = useGlobalState();
  return state.currentUserId;
}

export function useProject(projectId: string): Project | undefined {
  const state = useGlobalState();
  return state.projects.get(projectId);
}

export function useProjects(): Project[] {
  const state = useGlobalState();
  return useMemo(() => Array.from(state.projects.values()), [state.projects]);
}

export function useUserProjects(): { userProjects: Project[]; sharedProjects: Project[] } {
  const state = useGlobalState();
  
  return useMemo(() => {
    const userId = state.currentUserId;
    if (!userId) {
      return { userProjects: [], sharedProjects: [] };
    }

    const userProjects: Project[] = [];
    const sharedProjects: Project[] = [];

    for (const project of state.projects.values()) {
      if (project.ownerId === userId) {
        userProjects.push(project);
      } else {
        sharedProjects.push(project);
      }
    }

    return { userProjects, sharedProjects };
  }, [state.projects, state.currentUserId]);
}

export function useLayers(projectId: string): Layer[] {
  const state = useGlobalState();
  
  return useMemo(() => {
    const layers: Layer[] = [];
    for (const layer of state.layers.values()) {
      if (layer.projectId === projectId) {
        layers.push(layer);
      }
    }
    return layers.sort((a, b) => a.index - b.index);
  }, [state.layers, projectId]);
}

export function useChunks(projectId: string): Chunk[] {
  const state = useGlobalState();
  
  return useMemo(() => {
    const chunks: Chunk[] = [];
    for (const chunk of state.chunks.values()) {
      if (chunk.projectId === projectId) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }, [state.chunks, projectId]);
}

export function useLayerChunks(layerId: string): Chunk[] {
  const state = useGlobalState();
  
  return useMemo(() => {
    const chunks: Chunk[] = [];
    for (const chunk of state.chunks.values()) {
      if (chunk.layerId === layerId) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }, [state.chunks, layerId]);
}

export function useSelection(projectId: string): Selection | undefined {
  const state = useGlobalState();
  
  return useMemo(() => {
    const userId = state.currentUserId;
    if (!userId) return undefined;
    
    for (const selection of state.selections.values()) {
      if (selection.projectId === projectId && selection.identityId === userId) {
        return selection;
      }
    }
    return undefined;
  }, [state.selections, projectId, state.currentUserId]);
}

export function useProjectAccess(projectId: string): { hasWriteAccess: boolean; accessLevel: AccessType | null } {
  const state = useGlobalState();
  
  return useMemo(() => {
    const userId = state.currentUserId;
    const project = state.projects.get(projectId);
    
    if (!project) {
      return { hasWriteAccess: false, accessLevel: null };
    }
    
    const userProjectKey = `${projectId}:${userId}`;
    const userProject = state.userProjects.get(userProjectKey);
    
    if (userProject) {
      if (userProject.accessType.tag === "ReadWrite") {
        return { hasWriteAccess: true, accessLevel: userProject.accessType };
      } else if (userProject.accessType.tag === "Read") {
        return { hasWriteAccess: false, accessLevel: userProject.accessType };
      } else if (userProject.accessType.tag === "Inherited") {
        return { 
          hasWriteAccess: project.publicAccess.tag === "ReadWrite", 
          accessLevel: project.publicAccess 
        };
      }
    }
    
    if (project.ownerId === userId) {
      return { hasWriteAccess: true, accessLevel: { tag: "ReadWrite" as const } };
    }
    
    return { 
      hasWriteAccess: project.publicAccess.tag === "ReadWrite", 
      accessLevel: project.publicAccess 
    };
  }, [state.projects, state.userProjects, projectId, state.currentUserId]);
}

export interface ChunkEventHandlers {
  onInsert: (callback: (chunk: Chunk) => void) => () => void;
  onUpdate: (callback: (oldChunk: Chunk, newChunk: Chunk) => void) => () => void;
  onDelete: (callback: (chunk: Chunk) => void) => () => void;
}

export function useChunkEvents(projectId: string): ChunkEventHandlers {
  const [prevChunks, setPrevChunks] = useState<Map<string, Chunk>>(new Map());
  const [insertCallbacks] = useState<Set<(chunk: Chunk) => void>>(new Set());
  const [updateCallbacks] = useState<Set<(oldChunk: Chunk, newChunk: Chunk) => void>>(new Set());
  const [deleteCallbacks] = useState<Set<(chunk: Chunk) => void>>(new Set());

  useEffect(() => {
    const unsubscribe = globalStore.subscribe((state) => {
      const currentChunks = new Map<string, Chunk>();
      for (const chunk of state.chunks.values()) {
        if (chunk.projectId === projectId) {
          currentChunks.set(chunk.id, chunk);
        }
      }

      for (const [id, chunk] of currentChunks) {
        const prev = prevChunks.get(id);
        if (!prev) {
          for (const cb of insertCallbacks) cb(chunk);
        } else if (prev !== chunk) {
          for (const cb of updateCallbacks) cb(prev, chunk);
        }
      }

      for (const [id, chunk] of prevChunks) {
        if (!currentChunks.has(id)) {
          for (const cb of deleteCallbacks) cb(chunk);
        }
      }

      setPrevChunks(currentChunks);
    });

    return unsubscribe;
  }, [projectId, prevChunks, insertCallbacks, updateCallbacks, deleteCallbacks]);

  const onInsert = useCallback((callback: (chunk: Chunk) => void) => {
    insertCallbacks.add(callback);
    return () => { insertCallbacks.delete(callback); };
  }, [insertCallbacks]);

  const onUpdate = useCallback((callback: (oldChunk: Chunk, newChunk: Chunk) => void) => {
    updateCallbacks.add(callback);
    return () => { updateCallbacks.delete(callback); };
  }, [updateCallbacks]);

  const onDelete = useCallback((callback: (chunk: Chunk) => void) => {
    deleteCallbacks.add(callback);
    return () => { deleteCallbacks.delete(callback); };
  }, [deleteCallbacks]);

  return { onInsert, onUpdate, onDelete };
}

export interface LayerEventHandlers {
  onInsert: (callback: (layer: Layer) => void) => () => void;
  onUpdate: (callback: (oldLayer: Layer, newLayer: Layer) => void) => () => void;
  onDelete: (callback: (layer: Layer) => void) => () => void;
}

export function useLayerEvents(projectId: string): LayerEventHandlers {
  const [prevLayers, setPrevLayers] = useState<Map<string, Layer>>(new Map());
  const [insertCallbacks] = useState<Set<(layer: Layer) => void>>(new Set());
  const [updateCallbacks] = useState<Set<(oldLayer: Layer, newLayer: Layer) => void>>(new Set());
  const [deleteCallbacks] = useState<Set<(layer: Layer) => void>>(new Set());

  useEffect(() => {
    const unsubscribe = globalStore.subscribe((state) => {
      const currentLayers = new Map<string, Layer>();
      for (const layer of state.layers.values()) {
        if (layer.projectId === projectId) {
          currentLayers.set(layer.id, layer);
        }
      }

      for (const [id, layer] of currentLayers) {
        const prev = prevLayers.get(id);
        if (!prev) {
          for (const cb of insertCallbacks) cb(layer);
        } else if (prev !== layer) {
          for (const cb of updateCallbacks) cb(prev, layer);
        }
      }

      for (const [id, layer] of prevLayers) {
        if (!currentLayers.has(id)) {
          for (const cb of deleteCallbacks) cb(layer);
        }
      }

      setPrevLayers(currentLayers);
    });

    return unsubscribe;
  }, [projectId, prevLayers, insertCallbacks, updateCallbacks, deleteCallbacks]);

  const onInsert = useCallback((callback: (layer: Layer) => void) => {
    insertCallbacks.add(callback);
    return () => { insertCallbacks.delete(callback); };
  }, [insertCallbacks]);

  const onUpdate = useCallback((callback: (oldLayer: Layer, newLayer: Layer) => void) => {
    updateCallbacks.add(callback);
    return () => { updateCallbacks.delete(callback); };
  }, [updateCallbacks]);

  const onDelete = useCallback((callback: (layer: Layer) => void) => {
    deleteCallbacks.add(callback);
    return () => { deleteCallbacks.delete(callback); };
  }, [deleteCallbacks]);

  return { onInsert, onUpdate, onDelete };
}

export interface SelectionEventHandlers {
  onInsert: (callback: (selection: Selection) => void) => () => void;
  onUpdate: (callback: (oldSelection: Selection, newSelection: Selection) => void) => () => void;
  onDelete: (callback: (selection: Selection) => void) => () => void;
}

export function useSelectionEvents(projectId: string): SelectionEventHandlers {
  const [prevSelections, setPrevSelections] = useState<Map<string, Selection>>(new Map());
  const [insertCallbacks] = useState<Set<(selection: Selection) => void>>(new Set());
  const [updateCallbacks] = useState<Set<(oldSelection: Selection, newSelection: Selection) => void>>(new Set());
  const [deleteCallbacks] = useState<Set<(selection: Selection) => void>>(new Set());

  useEffect(() => {
    const unsubscribe = globalStore.subscribe((state) => {
      const currentSelections = new Map<string, Selection>();
      for (const selection of state.selections.values()) {
        if (selection.projectId === projectId) {
          currentSelections.set(selection.id, selection);
        }
      }

      for (const [id, selection] of currentSelections) {
        const prev = prevSelections.get(id);
        if (!prev) {
          for (const cb of insertCallbacks) cb(selection);
        } else if (prev !== selection) {
          for (const cb of updateCallbacks) cb(prev, selection);
        }
      }

      for (const [id, selection] of prevSelections) {
        if (!currentSelections.has(id)) {
          for (const cb of deleteCallbacks) cb(selection);
        }
      }

      setPrevSelections(currentSelections);
    });

    return unsubscribe;
  }, [projectId, prevSelections, insertCallbacks, updateCallbacks, deleteCallbacks]);

  const onInsert = useCallback((callback: (selection: Selection) => void) => {
    insertCallbacks.add(callback);
    return () => { insertCallbacks.delete(callback); };
  }, [insertCallbacks]);

  const onUpdate = useCallback((callback: (oldSelection: Selection, newSelection: Selection) => void) => {
    updateCallbacks.add(callback);
    return () => { updateCallbacks.delete(callback); };
  }, [updateCallbacks]);

  const onDelete = useCallback((callback: (selection: Selection) => void) => {
    deleteCallbacks.add(callback);
    return () => { deleteCallbacks.delete(callback); };
  }, [deleteCallbacks]);

  return { onInsert, onUpdate, onDelete };
}
