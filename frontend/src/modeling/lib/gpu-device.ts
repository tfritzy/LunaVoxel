let gpuDevice: GPUDevice | null = null;
let gpuInitPromise: Promise<GPUDevice | null> | null = null;
let gpuAvailable: boolean | null = null;

export async function getGPUDevice(): Promise<GPUDevice | null> {
  if (gpuAvailable === false) return null;
  if (gpuDevice) return gpuDevice;

  if (!gpuInitPromise) {
    gpuInitPromise = initGPUDevice();
  }

  return gpuInitPromise;
}

export function isGPUAvailable(): boolean | null {
  return gpuAvailable;
}

async function initGPUDevice(): Promise<GPUDevice | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      gpuAvailable = false;
      return null;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      gpuAvailable = false;
      return null;
    }

    const device = await adapter.requestDevice();
    device.lost.then(() => {
      gpuDevice = null;
      gpuInitPromise = null;
      gpuAvailable = null;
    });

    gpuDevice = device;
    gpuAvailable = true;
    return device;
  } catch {
    gpuAvailable = false;
    return null;
  }
}
