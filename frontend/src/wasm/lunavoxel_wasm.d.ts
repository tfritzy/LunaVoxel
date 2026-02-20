/* tslint:disable */
/* eslint-disable */

export class WasmExteriorFacesFinder {
    free(): void;
    [Symbol.dispose](): void;
    findExteriorFaces(voxel_data: Uint8Array, texture_width: number, block_atlas_mapping: Int32Array, dim_x: number, dim_y: number, dim_z: number, max_vertices: number, max_indices: number, selection_buffer: Uint8Array, sel_world_dim_y: number, sel_world_dim_z: number, chunk_off_x: number, chunk_off_y: number, chunk_off_z: number, selection_empty: boolean): void;
    getAO(): Float32Array;
    getIndexCount(): number;
    getIndices(): Uint32Array;
    getIsSelected(): Float32Array;
    getNormals(): Float32Array;
    getUVs(): Float32Array;
    getVertexCount(): number;
    getVertices(): Float32Array;
    constructor(max_dimension: number);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmexteriorfacesfinder_free: (a: number, b: number) => void;
    readonly wasmexteriorfacesfinder_findExteriorFaces: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number) => void;
    readonly wasmexteriorfacesfinder_getAO: (a: number) => [number, number];
    readonly wasmexteriorfacesfinder_getIndexCount: (a: number) => number;
    readonly wasmexteriorfacesfinder_getIndices: (a: number) => [number, number];
    readonly wasmexteriorfacesfinder_getIsSelected: (a: number) => [number, number];
    readonly wasmexteriorfacesfinder_getNormals: (a: number) => [number, number];
    readonly wasmexteriorfacesfinder_getUVs: (a: number) => [number, number];
    readonly wasmexteriorfacesfinder_getVertexCount: (a: number) => number;
    readonly wasmexteriorfacesfinder_getVertices: (a: number) => [number, number];
    readonly wasmexteriorfacesfinder_new: (a: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
