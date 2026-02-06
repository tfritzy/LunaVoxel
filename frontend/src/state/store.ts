import type {
  Layer,
  Chunk,
  Selection,
  Vector3,
} from "./types";

export interface GlobalState {
  currentUserId: string | null;
  dimensions: Vector3;
  layers: Map<string, Layer>;
  chunks: Map<string, Chunk>;
  selections: Map<string, Selection>;
}

export type StateChangeListener = (state: GlobalState) => void;

class StateStore {
  private state: GlobalState;
  private listeners: Set<StateChangeListener> = new Set();

  constructor() {
    this.state = {
      currentUserId: null,
      dimensions: { x: 64, y: 64, z: 64 },
      layers: new Map(),
      chunks: new Map(),
      selections: new Map(),
    };
  }

  getState(): GlobalState {
    return this.state;
  }

  setState(newState: Partial<GlobalState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setCurrentUserId(userId: string | null) {
    this.state.currentUserId = userId;
    this.notifyListeners();
  }

  setDimensions(dimensions: Vector3) {
    this.state.dimensions = dimensions;
    this.notifyListeners();
  }

  setLayer(layer: Layer) {
    this.state.layers.set(layer.id, layer);
    this.notifyListeners();
  }

  deleteLayer(layerId: string) {
    this.state.layers.delete(layerId);
    this.notifyListeners();
  }

  setChunk(chunk: Chunk) {
    this.state.chunks.set(chunk.id, chunk);
    this.notifyListeners();
  }

  deleteChunk(chunkId: string) {
    this.state.chunks.delete(chunkId);
    this.notifyListeners();
  }

  setSelection(selection: Selection) {
    this.state.selections.set(selection.id, selection);
    this.notifyListeners();
  }

  deleteSelection(selectionId: string) {
    this.state.selections.delete(selectionId);
    this.notifyListeners();
  }
}

export const globalStore = new StateStore();
