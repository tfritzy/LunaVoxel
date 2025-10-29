import init from "@/wasm/vector3_wasm";

let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

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
      const instance = await init();
      wasmMemory = instance.memory;
      
      wasmInitialized = true;
      console.log("WASM module initialized successfully");
    } catch (error) {
      console.error("Failed to initialize WASM module:", error);
      wasmInitPromise = null;
      throw error;
    }
  })();

  return wasmInitPromise;
}

export function isWasmInitialized(): boolean {
  return wasmInitialized;
}

export function ensureWasmInitialized(): void {
  if (!wasmInitialized) {
    throw new Error(
      "WASM module not initialized. Please ensure initWasm() is called before using WASM functions."
    );
  }
}

export const getWasmMemory = (): WebAssembly.Memory => {
  if (!wasmMemory) {
    throw new Error("WASM memory not available. Ensure initWasm() completed successfully.");
  }
  return wasmMemory;
};