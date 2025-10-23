import * as THREE from "three";
import { Vector3 } from "@/module_bindings";
import init, { translate_positions_up } from "../wasm/vector3_wasm";

let wasmInitialized = false;

async function ensureWasmInitialized() {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
}

export async function translateVector3ArrayUp(
  positions: Vector3[],
  amount: number = 1.0
): Promise<Vector3[]> {
  await ensureWasmInitialized();

  const flatArray = new Float32Array(positions.length * 3);
  for (let i = 0; i < positions.length; i++) {
    flatArray[i * 3] = positions[i].x;
    flatArray[i * 3 + 1] = positions[i].y;
    flatArray[i * 3 + 2] = positions[i].z;
  }

  const result = translate_positions_up(flatArray, amount);

  const output: Vector3[] = [];
  for (let i = 0; i < result.length; i += 3) {
    output.push({
      x: result[i],
      y: result[i + 1],
      z: result[i + 2],
    });
  }

  return output;
}

export async function translateThreeVector3ArrayUp(
  positions: THREE.Vector3[],
  amount: number = 1.0
): Promise<THREE.Vector3[]> {
  await ensureWasmInitialized();

  const flatArray = new Float32Array(positions.length * 3);
  for (let i = 0; i < positions.length; i++) {
    flatArray[i * 3] = positions[i].x;
    flatArray[i * 3 + 1] = positions[i].y;
    flatArray[i * 3 + 2] = positions[i].z;
  }

  const result = translate_positions_up(flatArray, amount);

  const output: THREE.Vector3[] = [];
  for (let i = 0; i < result.length; i += 3) {
    output.push(new THREE.Vector3(result[i], result[i + 1], result[i + 2]));
  }

  return output;
}