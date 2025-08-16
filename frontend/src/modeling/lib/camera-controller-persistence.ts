import { CameraState } from "./camera-controller";

const CAMERA_STATE_KEY_PREFIX = "voxel_camera_state_";

export const CameraStatePersistence = {
    save(projectId: string, state: CameraState): void {
        try {
            const key = `${CAMERA_STATE_KEY_PREFIX}${projectId}`;
            const serializedState = JSON.stringify(state);
            sessionStorage.setItem(key, serializedState);
        } catch (error) {
            console.warn("Failed to save camera state:", error);
        }
    },

    load(projectId: string): CameraState | null {
        try {
            const key = `${CAMERA_STATE_KEY_PREFIX}${projectId}`;
            const serializedState = sessionStorage.getItem(key);

            if (!serializedState) {
                return null;
            }

            const state = JSON.parse(serializedState) as CameraState;

            if (!this.isValidCameraState(state)) {
                console.warn("Invalid camera state found, ignoring");
                this.clear(projectId);
                return null;
            }

            return state;
        } catch (error) {
            console.warn("Failed to load camera state:", error);
            return null;
        }
    },

    clear(projectId: string): void {
        try {
            const key = `${CAMERA_STATE_KEY_PREFIX}${projectId}`;
            sessionStorage.removeItem(key);
        } catch (error) {
            console.warn("Failed to clear camera state:", error);
        }
    },

    clearAll(): void {
        try {
            const keysToRemove: string[] = [];

            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key?.startsWith(CAMERA_STATE_KEY_PREFIX)) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(key => sessionStorage.removeItem(key));
        } catch (error) {
            console.warn("Failed to clear all camera states:", error);
        }
    },

    isValidCameraState(state: unknown): state is CameraState {
        if (!state || typeof state !== "object") {
            return false;
        }

        const s = state as Record<string, unknown>;

        return (
            typeof s.position === "object" &&
            s.position !== null &&
            typeof (s.position as Record<string, unknown>).x === "number" &&
            typeof (s.position as Record<string, unknown>).y === "number" &&
            typeof (s.position as Record<string, unknown>).z === "number" &&
            typeof s.target === "object" &&
            s.target !== null &&
            typeof (s.target as Record<string, unknown>).x === "number" &&
            typeof (s.target as Record<string, unknown>).y === "number" &&
            typeof (s.target as Record<string, unknown>).z === "number" &&
            typeof s.distance === "number" &&
            typeof s.phi === "number" &&
            typeof s.theta === "number" &&
            typeof s.currentRotationAngle === "number" &&
            typeof s.targetRotationAngle === "number" &&
            s.distance > 0 &&
            !isNaN(s.distance) &&
            !isNaN(s.phi) &&
            !isNaN(s.theta) &&
            !isNaN(s.currentRotationAngle) &&
            !isNaN(s.targetRotationAngle)
        );
    },
};