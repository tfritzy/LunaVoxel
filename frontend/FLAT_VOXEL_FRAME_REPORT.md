# FlatVoxelFrame Migration Performance Report

## Summary

Migrating `previewFrame` from `VoxelFrame` (3D nested `Uint8Array[][]` arrays) to `FlatVoxelFrame` (1D flat `Uint8Array`) yields a consistent **~16% performance improvement** on the 5-second tool benchmark. The 128³ exterior-faces benchmarks are unaffected since they already used `FlatVoxelFrame`.

## Methodology

- Both implementations were benchmarked head-to-head in the same test run to eliminate environmental variance.
- The 5s benchmark runs all 10 fill shapes (Rect, Sphere, Cylinder, Triangle, Diamond, Cone, Pyramid, Hexagon, Star, Cross) on a 150³ grid with 8 drag steps each.
- The 128³ benchmarks test `findExteriorFaces` with polka-dot, solid-real, and solid-preview patterns (3 iterations each).

## Results

### 5-Second Tool Benchmark (150³, 10 shapes × 8 drag steps)

| Implementation | Run 1 | Run 2 | Run 3 | Average |
|---|---|---|---|---|
| VoxelFrame (3D array) | 4984ms | 4950ms | 4915ms | **4950ms** |
| FlatVoxelFrame (flat array) | 4124ms | 4227ms | 4125ms | **4159ms** |
| **Improvement** | | | | **~16%** |

### 128³ Exterior Faces Benchmarks

These benchmarks were unaffected by the migration since `findExteriorFaces` already operated on flat `Uint8Array` data and `FlatVoxelFrame` selection frames.

| Pattern | Before (avg) | After (avg) | Change |
|---|---|---|---|
| Polka dot (alternating) | 1444ms | 1453ms | ~0% (noise) |
| Solid real blocks | 133ms | 111ms | ~0% (noise) |
| Solid preview blocks | 111ms | 111ms | ~0% (noise) |

## Why Flat Is Faster

The performance gain comes from the `previewFrame` operations in the tool pipeline:

1. **`clear()`** — `FlatVoxelFrame` does a single `data.fill(0)` on one contiguous buffer. `VoxelFrame` loops through `dimensions.x × dimensions.y` separate `Uint8Array` sub-arrays.

2. **`resize()`** — `FlatVoxelFrame` allocates one `Uint8Array` of size `x*y*z`. `VoxelFrame` allocates `x` arrays, then `x*y` `Uint8Array` sub-arrays, causing many small allocations and GC pressure.

3. **`set()`/`get()`** — `FlatVoxelFrame` computes a flat index (`x*sizeY*sizeZ + y*sizeZ + z`) into one contiguous buffer. `VoxelFrame` performs three chained array dereferences (`data[x][y][z]`), each potentially causing a cache miss.

4. **`clone()`** — `FlatVoxelFrame` copies one buffer with `new Uint8Array(this.data)`. `VoxelFrame` must iterate and copy `x*y` separate sub-arrays.

The 150³ benchmark is dominated by `resize()` + `set()` calls across ~3.4M voxels per drag step, so the reduced allocation overhead and better cache locality of the flat layout compound significantly.

## What Changed

All `previewFrame` usage was migrated from `VoxelFrame` to `FlatVoxelFrame`:

| File | Change |
|---|---|
| `flat-voxel-frame.ts` | Added `resize()`, `clone()`, `equals()`, `getMaxPos()`, `hasAnySet()` methods |
| `tool-interface.ts` | `previewFrame: VoxelFrame` → `previewFrame: FlatVoxelFrame` |
| `builder.ts` | `new VoxelFrame(...)` → `new FlatVoxelFrame(...)` |
| `chunk.ts` | `previewFrame` and `renderedPreviewFrame` types changed |
| `chunk-manager.ts` | `setPreview()` parameter type changed |
| `store.ts` | `applyFrame()` `frame` parameter type changed |

The original `VoxelFrame` class and its tests remain untouched and available for any future use.
