pub struct VoxelDataUtils;

impl VoxelDataUtils {
    pub const ROTATION_MASK: u32 = 0x07;
    pub const IS_PREVIEW_MASK: u32 = 0x08;
    pub const TYPE_MASK: u32 = 0x3FF;
    pub const TYPE_SHIFT: u32 = 6;
    pub const CLEAR_PREVIEW_MASK: u32 = 0xFFFFFFF7;
    pub const VERSION_SHIFT: u32 = 16;
    pub const VERSION_MASK: u32 = 0xFF;
    pub const CLEAR_VERSION_MASK: u32 = 0xFF00FFFF;

    pub fn get_block_type(voxel_data: u32) -> u32 {
        (voxel_data >> Self::TYPE_SHIFT) & Self::TYPE_MASK
    }

    pub fn get_rotation(voxel_data: u32) -> u32 {
        voxel_data & Self::ROTATION_MASK
    }

    pub fn is_preview(voxel_data: u32) -> bool {
        (voxel_data & Self::IS_PREVIEW_MASK) != 0
    }

    pub fn is_block_present(voxel_data: u32) -> bool {
        voxel_data != 0
    }

    pub fn set_preview_bit(voxel_data: u32) -> u32 {
        voxel_data | Self::IS_PREVIEW_MASK
    }

    pub fn clear_preview_bit(voxel_data: u32) -> u32 {
        voxel_data & Self::CLEAR_PREVIEW_MASK
    }

    pub fn encode_block_data(block_type: u32, rotation: u32, version: u32) -> u32 {
        let wrapped_block_type = block_type & Self::TYPE_MASK;
        let wrapped_rotation = rotation & Self::ROTATION_MASK;
        let mut wrapped_version = version & Self::VERSION_MASK;

        if wrapped_version == 0 {
            wrapped_version = 1;
        }

        (wrapped_block_type << Self::TYPE_SHIFT)
            | wrapped_rotation
            | (wrapped_version << Self::VERSION_SHIFT)
    }

    pub fn get_version(voxel_data: u32) -> u32 {
        (voxel_data >> Self::VERSION_SHIFT) & Self::VERSION_MASK
    }

    pub fn set_version(voxel_data: u32, version: u32) -> u32 {
        let cleared = voxel_data & Self::CLEAR_VERSION_MASK;
        cleared | ((version & Self::VERSION_MASK) << Self::VERSION_SHIFT)
    }
}
