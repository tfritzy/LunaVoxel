import init from "@/wasm/vector3_wasm";

let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module. Can be called multiple times safely.
 * Subsequent calls will return the same promise.
 */
export async function initWasm(): Promise<void> {
  if (wasmInitialized) {
    return;
  }

  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      console.log("Initializing WASM module...");
      await init();
      wasmInitialized = true;
      console.log("WASM module initialized successfully");
    } catch (error) {
      console.error("Failed to initialize WASM module:", error);
      wasmInitPromise = null; // Reset so it can be retried
      throw error;
    }
  })();

  return wasmInitPromise;
}

/**
 * Check if WASM has been initialized
 */
export function isWasmInitialized(): boolean {
  return wasmInitialized;
}

/**
 * Ensures WASM is initialized before proceeding.
 * Throws an error if WASM is not initialized.
 */
export function ensureWasmInitialized(): void {
  if (!wasmInitialized) {
    throw new Error(
      "WASM module not initialized. Please ensure initWasm() is called before using WASM functions."
    );
  }
}
