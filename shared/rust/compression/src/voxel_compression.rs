use lz4_flex::{compress_prepend_size, decompress_size_prepended};

pub struct VoxelCompression;

impl VoxelCompression {
    pub fn compress(voxel_data: &[u8]) -> Vec<u8> {
        let rle_compressed = Self::rle_compress(voxel_data);
        compress_prepend_size(&rle_compressed)
    }

    pub fn decompress(compressed_data: &[u8]) -> Vec<u8> {
        if compressed_data.is_empty() {
            return Vec::new();
        }
        
        match decompress_size_prepended(compressed_data) {
            Ok(rle_data) => Self::rle_decompress(&rle_data),
            Err(_) => Vec::new(), // Return empty vec on decompression failure
        }
    }

    fn rle_compress(voxel_data: &[u8]) -> Vec<u8> {
        if voxel_data.is_empty() {
            panic!("Voxel data must not be empty");
        }

        let run_count = Self::count_runs(voxel_data);
        let total_size = 4 + run_count * 3;
        let mut compressed = vec![0u8; total_size];

        let original_length = voxel_data.len() as u32;
        compressed[0] = (original_length & 0xFF) as u8;
        compressed[1] = ((original_length >> 8) & 0xFF) as u8;
        compressed[2] = ((original_length >> 16) & 0xFF) as u8;
        compressed[3] = ((original_length >> 24) & 0xFF) as u8;

        let mut write_index = 4;
        let mut i = 0;

        while i < voxel_data.len() {
            let value = voxel_data[i];
            let mut run_length = 1u16;
            let mut j = i + 1;

            while j < voxel_data.len() && voxel_data[j] == value && run_length < 0xFFFF {
                run_length += 1;
                j += 1;
            }

            compressed[write_index] = value;
            compressed[write_index + 1] = (run_length & 0xFF) as u8;
            compressed[write_index + 2] = ((run_length >> 8) & 0xFF) as u8;

            write_index += 3;
            i = j;
        }

        compressed
    }

    fn rle_decompress(rle_data: &[u8]) -> Vec<u8> {
        if rle_data.len() < 4 {
            return Vec::new();
        }
        
        let original_length =
            u32::from_le_bytes([rle_data[0], rle_data[1], rle_data[2], rle_data[3]]) as usize;

        let data_start_index = 4;

        if (rle_data.len() - data_start_index) % 3 != 0 {
            return Vec::new(); // Return empty vec instead of panic
        }

        let mut decompressed = Vec::with_capacity(original_length);

        let mut i = data_start_index;
        while i + 2 < rle_data.len() {
            let value = rle_data[i];
            let run_length = u16::from_le_bytes([rle_data[i + 1], rle_data[i + 2]]);

            for _ in 0..run_length {
                decompressed.push(value);
            }

            i += 3;
        }

        decompressed
    }

    fn count_runs(data: &[u8]) -> usize {
        let mut run_count = 0;
        let mut i = 0;

        while i < data.len() {
            let value = data[i];
            let mut run_length = 1u16;
            let mut j = i + 1;

            while j < data.len() && data[j] == value && run_length < 0xFFFF {
                run_length += 1;
                j += 1;
            }

            run_count += 1;
            i = j;
        }

        run_count
    }

    pub fn get_voxel_at(compressed_data: &[u8], voxel_index: usize) -> u8 {
        let decompressed_data = Self::decompress(compressed_data);

        if voxel_index >= decompressed_data.len() {
            panic!("Voxel index is beyond the data range");
        }

        decompressed_data[voxel_index]
    }
}
