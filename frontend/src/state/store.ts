import type {
  Project,
  Layer,
  Chunk,
  Selection,
  PlayerCursor,
  UserProject,
  User,
} from "./types";

export interface GlobalState {
  currentUserId: string | null;
  users: Map<string, User>;
  projects: Map<string, Project>;
  layers: Map<string, Layer>;
  chunks: Map<string, Chunk>;
  selections: Map<string, Selection>;
  playerCursors: Map<string, PlayerCursor>;
  userProjects: Map<string, UserProject>;
}

export type StateChangeListener = (state: GlobalState) => void;

class StateStore {
  private state: GlobalState;
  private listeners: Set<StateChangeListener> = new Set();

  constructor() {
    this.state = {
      currentUserId: null,
      users: new Map(),
      projects: new Map(),
      layers: new Map(),
      chunks: new Map(),
      selections: new Map(),
      playerCursors: new Map(),
      userProjects: new Map(),
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

  setProject(project: Project) {
    this.state.projects.set(project.id, project);
    this.notifyListeners();
  }

  deleteProject(projectId: string) {
    this.state.projects.delete(projectId);
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

  setPlayerCursor(cursor: PlayerCursor) {
    this.state.playerCursors.set(cursor.id, cursor);
    this.notifyListeners();
  }

  deletePlayerCursor(cursorId: string) {
    this.state.playerCursors.delete(cursorId);
    this.notifyListeners();
  }

  setUserProject(userProject: UserProject) {
    const key = `${userProject.projectId}:${userProject.userId}`;
    this.state.userProjects.set(key, userProject);
    this.notifyListeners();
  }

  deleteUserProject(projectId: string, userId: string) {
    const key = `${projectId}:${userId}`;
    this.state.userProjects.delete(key);
    this.notifyListeners();
  }

  setUser(user: User) {
    this.state.users.set(user.id, user);
    this.notifyListeners();
  }
}

export const globalStore = new StateStore();
