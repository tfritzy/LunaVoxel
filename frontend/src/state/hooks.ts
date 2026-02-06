import { useState, useEffect, useCallback, useMemo } from "react";
import { globalStore, type GlobalState } from "./store";
import type { Layer, Chunk, Selection, Vector3 } from "./types";
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

export function useDimensions(): Vector3 {
  const state = useGlobalState();
  return state.dimensions;
}

export function useLayers(): Layer[] {
  const state = useGlobalState();
  
  return useMemo(() => {
    const layers: Layer[] = [];
    for (const layer of state.layers.values()) {
      layers.push(layer);
    }
    return layers.sort((a, b) => a.index - b.index);
  }, [state.layers]);
}

export function useChunks(): Chunk[] {
  const state = useGlobalState();
  
  return useMemo(() => {
    const chunks: Chunk[] = [];
    for (const chunk of state.chunks.values()) {
      chunks.push(chunk);
    }
    return chunks;
  }, [state.chunks]);
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

export function useSelection(): Selection | undefined {
  const state = useGlobalState();
  
  return useMemo(() => {
    const userId = state.currentUserId;
    if (!userId) return undefined;
    
    for (const selection of state.selections.values()) {
      if (selection.identityId === userId) {
        return selection;
      }
    }
    return undefined;
  }, [state.selections, state.currentUserId]);
}

export interface ChunkEventHandlers {
  onInsert: (callback: (chunk: Chunk) => void) => () => void;
  onUpdate: (callback: (oldChunk: Chunk, newChunk: Chunk) => void) => () => void;
  onDelete: (callback: (chunk: Chunk) => void) => () => void;
}

export function useChunkEvents(): ChunkEventHandlers {
  const [prevChunks, setPrevChunks] = useState<Map<string, Chunk>>(new Map());
  const [insertCallbacks] = useState<Set<(chunk: Chunk) => void>>(new Set());
  const [updateCallbacks] = useState<Set<(oldChunk: Chunk, newChunk: Chunk) => void>>(new Set());
  const [deleteCallbacks] = useState<Set<(chunk: Chunk) => void>>(new Set());

  useEffect(() => {
    const unsubscribe = globalStore.subscribe((state) => {
      const currentChunks = new Map<string, Chunk>();
      for (const chunk of state.chunks.values()) {
        currentChunks.set(chunk.id, chunk);
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
  }, [prevChunks, insertCallbacks, updateCallbacks, deleteCallbacks]);

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

export function useLayerEvents(): LayerEventHandlers {
  const [prevLayers, setPrevLayers] = useState<Map<string, Layer>>(new Map());
  const [insertCallbacks] = useState<Set<(layer: Layer) => void>>(new Set());
  const [updateCallbacks] = useState<Set<(oldLayer: Layer, newLayer: Layer) => void>>(new Set());
  const [deleteCallbacks] = useState<Set<(layer: Layer) => void>>(new Set());

  useEffect(() => {
    const unsubscribe = globalStore.subscribe((state) => {
      const currentLayers = new Map<string, Layer>();
      for (const layer of state.layers.values()) {
        currentLayers.set(layer.id, layer);
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
  }, [prevLayers, insertCallbacks, updateCallbacks, deleteCallbacks]);

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

export function useSelectionEvents(): SelectionEventHandlers {
  const [prevSelections, setPrevSelections] = useState<Map<string, Selection>>(new Map());
  const [insertCallbacks] = useState<Set<(selection: Selection) => void>>(new Set());
  const [updateCallbacks] = useState<Set<(oldSelection: Selection, newSelection: Selection) => void>>(new Set());
  const [deleteCallbacks] = useState<Set<(selection: Selection) => void>>(new Set());

  useEffect(() => {
    const unsubscribe = globalStore.subscribe((state) => {
      const currentSelections = new Map<string, Selection>();
      for (const selection of state.selections.values()) {
        currentSelections.set(selection.id, selection);
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
  }, [prevSelections, insertCallbacks, updateCallbacks, deleteCallbacks]);

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
