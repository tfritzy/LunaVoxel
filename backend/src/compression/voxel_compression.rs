use lz4_flex::{compress_prepend_size, decompress_size_prepended};

pub struct VoxelCompression;

impl VoxelCompression {
    pub fn compress(voxel_data: &[u32]) -> Vec<u8> {
        let rle_compressed = Self::rle_compress(voxel_data);
        compress_prepend_size(&rle_compressed)
    }

    pub fn decompress(compressed_data: &[u8]) -> Vec<u32> {
        let rle_data = decompress_size_prepended(compressed_data)
            .expect("Failed to decompress LZ4 data");
        Self::rle_decompress(&rle_data)
    }

    fn rle_compress(voxel_data: &[u32]) -> Vec<u8> {
        if voxel_data.is_empty() {
            panic!("Voxel data must not be empty");
        }

        let run_count = Self::count_runs(voxel_data);
        let total_size = 4 + run_count * 6;
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

            let value_low = (value & 0xFFFF) as u16;
            let value_high = ((value >> 16) & 0xFFFF) as u16;

            compressed[write_index] = (value_low & 0xFF) as u8;
            compressed[write_index + 1] = ((value_low >> 8) & 0xFF) as u8;
            compressed[write_index + 2] = (value_high & 0xFF) as u8;
            compressed[write_index + 3] = ((value_high >> 8) & 0xFF) as u8;
            compressed[write_index + 4] = (run_length & 0xFF) as u8;
            compressed[write_index + 5] = ((run_length >> 8) & 0xFF) as u8;

            write_index += 6;
            i = j;
        }

        compressed
    }

    fn rle_decompress(rle_data: &[u8]) -> Vec<u32> {
        let original_length = u32::from_le_bytes([
            rle_data[0],
            rle_data[1],
            rle_data[2],
            rle_data[3],
        ]) as usize;

        let data_start_index = 4;

        if (rle_data.len() - data_start_index) % 6 != 0 {
            panic!("RLE data must be in 6-byte groups");
        }

        let mut decompressed = Vec::with_capacity(original_length);

        let mut i = data_start_index;
        while i < rle_data.len() {
            let value_low = u16::from_le_bytes([rle_data[i], rle_data[i + 1]]);
            let value_high = u16::from_le_bytes([rle_data[i + 2], rle_data[i + 3]]);
            let run_length = u16::from_le_bytes([rle_data[i + 4], rle_data[i + 5]]);

            let value = ((value_low as u32) & 0xFFFF) | (((value_high as u32) & 0xFFFF) << 16);

            for _ in 0..run_length {
                decompressed.push(value);
            }

            i += 6;
        }

        decompressed
    }

    fn count_runs(data: &[u32]) -> usize {
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

    pub fn get_voxel_at(compressed_data: &[u8], voxel_index: usize) -> u32 {
        let decompressed_data = Self::decompress(compressed_data);

        if voxel_index >= decompressed_data.len() {
            panic!("Voxel index is beyond the data range");
        }

        decompressed_data[voxel_index]
    }
}