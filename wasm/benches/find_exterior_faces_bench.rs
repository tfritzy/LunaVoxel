use criterion::{Criterion, black_box, criterion_group, criterion_main};
use lunavoxel_wasm::find_exterior_faces::ExteriorFacesFinder;
use lunavoxel_wasm::mesh_arrays::MeshArrays;

fn create_filled_voxel_data(dim_x: usize, dim_y: usize, dim_z: usize) -> Vec<u8> {
    vec![1u8; dim_x * dim_y * dim_z]
}

fn create_sparse_voxel_data(dim_x: usize, dim_y: usize, dim_z: usize) -> Vec<u8> {
    let mut data = vec![0u8; dim_x * dim_y * dim_z];
    for x in 0..dim_x {
        for y in 0..dim_y {
            for z in 0..dim_z {
                if (x + y + z) % 2 == 0 {
                    data[x * dim_y * dim_z + y * dim_z + z] = 1;
                }
            }
        }
    }
    data
}

fn bench_find_exterior_faces(c: &mut Criterion) {
    let mut group = c.benchmark_group("find_exterior_faces");

    {
        let (dx, dy, dz) = (32, 32, 32);
        let data = create_filled_voxel_data(dx, dy, dz);
        let mapping: Vec<i32> = (0..2).collect();
        let sel = vec![0u8; dx * dy * dz];
        let max_dim = dx.max(dy).max(dz);
        let mut finder = ExteriorFacesFinder::new(max_dim);
        let total_voxels = dx * dy * dz;
        let max_faces = total_voxels * 6;
        let mut mesh_arrays = MeshArrays::new(max_faces * 4, max_faces * 6);

        group.bench_function("solid_32x32x32", |b| {
            b.iter(|| {
                finder.find_exterior_faces(
                    black_box(&data),
                    4,
                    &mapping,
                    dx,
                    dy,
                    dz,
                    &mut mesh_arrays,
                    &sel,
                    dx,
                    dy,
                    dz,
                    true,
                );
            });
        });
    }

    {
        let (dx, dy, dz) = (32, 32, 32);
        let data = create_sparse_voxel_data(dx, dy, dz);
        let mapping: Vec<i32> = (0..2).collect();
        let sel = vec![0u8; dx * dy * dz];
        let max_dim = dx.max(dy).max(dz);
        let mut finder = ExteriorFacesFinder::new(max_dim);
        let total_voxels = dx * dy * dz;
        let max_faces = total_voxels * 6;
        let mut mesh_arrays = MeshArrays::new(max_faces * 4, max_faces * 6);

        group.bench_function("sparse_32x32x32", |b| {
            b.iter(|| {
                finder.find_exterior_faces(
                    black_box(&data),
                    4,
                    &mapping,
                    dx,
                    dy,
                    dz,
                    &mut mesh_arrays,
                    &sel,
                    dx,
                    dy,
                    dz,
                    true,
                );
            });
        });
    }

    {
        let (dx, dy, dz) = (64, 64, 64);
        let data = create_filled_voxel_data(dx, dy, dz);
        let mapping: Vec<i32> = (0..2).collect();
        let sel = vec![0u8; dx * dy * dz];
        let max_dim = dx.max(dy).max(dz);
        let mut finder = ExteriorFacesFinder::new(max_dim);
        let total_voxels = dx * dy * dz;
        let max_faces = total_voxels * 6;
        let mut mesh_arrays = MeshArrays::new(max_faces * 4, max_faces * 6);

        group.bench_function("solid_64x64x64", |b| {
            b.iter(|| {
                finder.find_exterior_faces(
                    black_box(&data),
                    4,
                    &mapping,
                    dx,
                    dy,
                    dz,
                    &mut mesh_arrays,
                    &sel,
                    dx,
                    dy,
                    dz,
                    true,
                );
            });
        });
    }

    {
        let (dx, dy, dz) = (64, 64, 64);
        let data = create_sparse_voxel_data(dx, dy, dz);
        let mapping: Vec<i32> = (0..2).collect();
        let sel = vec![0u8; dx * dy * dz];
        let max_dim = dx.max(dy).max(dz);
        let mut finder = ExteriorFacesFinder::new(max_dim);
        let total_voxels = dx * dy * dz;
        let max_faces = total_voxels * 6;
        let mut mesh_arrays = MeshArrays::new(max_faces * 4, max_faces * 6);

        group.bench_function("sparse_64x64x64", |b| {
            b.iter(|| {
                finder.find_exterior_faces(
                    black_box(&data),
                    4,
                    &mapping,
                    dx,
                    dy,
                    dz,
                    &mut mesh_arrays,
                    &sel,
                    dx,
                    dy,
                    dz,
                    true,
                );
            });
        });
    }

    group.finish();
}

criterion_group!(benches, bench_find_exterior_faces);
criterion_main!(benches);
