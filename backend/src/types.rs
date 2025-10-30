use spacetimedb::{table, Identity, SpacetimeType, Timestamp};

#[derive(Clone, Copy, PartialEq, Eq, Debug, SpacetimeType)]
pub struct Vector3 {
    pub x: i32,
    pub y: i32,
    pub z: i32,
}

impl Vector3 {
    pub fn new(x: i32, y: i32, z: i32) -> Self {
        Self { x, y, z }
    }
}

#[derive(Clone, Copy, PartialEq, Debug, SpacetimeType)]
pub struct Vector3Float {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Vector3Float {
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, SpacetimeType)]
pub enum ToolType {
    Build,
    Erase,
    Paint,
    BlockPicker,
    MagicSelect,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, SpacetimeType)]
pub enum AccessType {
    None,
    Inherited,
    Read,
    ReadWrite,
}

#[table(name = projects, public)]
pub struct Project {
    #[primary_key]
    pub id: String,
    pub name: String,
    pub dimensions: Vector3,
    pub owner: Identity,
    pub updated: Timestamp,
    pub created: Timestamp,
    pub public_access: AccessType,
}

impl Project {
    pub fn build(
        id: String,
        name: String,
        x_dim: i32,
        y_dim: i32,
        z_dim: i32,
        owner: Identity,
        now: Timestamp,
    ) -> Self {
        Self {
            id,
            name,
            dimensions: Vector3::new(x_dim, y_dim, z_dim),
            owner,
            updated: now,
            created: now,
            public_access: AccessType::None,
        }
    }
}

#[table(name = user_projects, public, index(name = idx_user_project, btree(columns = [project_id, user])), index(name = idx_project_id_email, btree(columns = [project_id, email])), index(name = idx_project_id_only, btree(columns = [project_id])), index(name = idx_user_email, btree(columns = [user, email])), index(name = idx_user_only, btree(columns = [user])))]
#[derive(Debug)]
pub struct UserProject {
    #[primary_key]
    pub id: String,
    pub project_id: String,
    pub access_type: AccessType,
    pub user: Identity,
    pub email: Option<String>,
    pub name: Option<String>,
}

impl UserProject {
    pub fn build(
        user: Identity,
        project_id: String,
        access_type: AccessType,
        email: Option<String>,
        id: Option<String>,
        timestamp: Timestamp,
    ) -> Self {
        use crate::helpers::IdGenerator;
        Self {
            id: id.unwrap_or_else(|| IdGenerator::generate("up", timestamp)),
            user,
            project_id,
            access_type,
            email,
            name: None,
        }
    }
}

#[table(name = project_blocks, public)]
pub struct ProjectBlocks {
    #[primary_key]
    pub project_id: String,
    pub face_colors: Vec<Vec<i32>>,
}

#[table(name = player_cursor, public, index(name = player_cursor_project, btree(columns = [project_id])), index(name = player_cursor_project_player, btree(columns = [project_id, player])), index(name = player_cursor_player, btree(columns = [player])))]
pub struct PlayerCursor {
    #[primary_key]
    pub id: String,
    pub project_id: String,
    pub display_name: String,
    pub player: Identity,
    pub position: Option<Vector3Float>,
    pub normal: Option<Vector3Float>,
    pub last_updated: Timestamp,
    pub tool_type: Option<ToolType>,
}

#[table(name = layer, public, index(name = layer_project, btree(columns = [project_id])), index(name = project_index, btree(columns = [project_id, index])))]
#[derive(Clone)]
pub struct Layer {
    #[primary_key]
    pub id: String,
    pub project_id: String,
    pub x_dim: i32,
    pub y_dim: i32,
    pub z_dim: i32,
    pub index: i32,
    pub voxels: Vec<u8>,
    pub visible: bool,
    pub locked: bool,
    pub name: String,
}

impl Layer {
    pub fn build(
        project_id: String,
        x_dim: i32,
        y_dim: i32,
        z_dim: i32,
        index: i32,
        timestamp: Timestamp,
    ) -> Self {
        use crate::helpers::IdGenerator;
        use voxel_compression::VoxelCompression;

        let empty: u8 = 0;
        let size: usize = (x_dim * y_dim * z_dim) as usize;
        let voxels = vec![empty; size];
        let compressed = VoxelCompression::compress(&voxels);

        Self {
            id: IdGenerator::generate("lyr", timestamp),
            project_id,
            x_dim,
            y_dim,
            z_dim,
            index,
            voxels: compressed,
            visible: true,
            locked: false,
            name: format!("Layer {}", index),
        }
    }
}

#[table(name = user, public, index(name = email, btree(columns = [email])))]
pub struct User {
    #[primary_key]
    pub identity: Identity,
    pub email: Option<String>,
    pub name: Option<String>,
}

#[table(name = selections, public, index(name = identity_project, btree(columns = [identity, project_id])))]
pub struct Selection {
    #[primary_key]
    pub id: String,
    pub identity: Identity,
    pub project_id: String,
    pub layer: i32,
    pub selection_data: Vec<u8>,
}

pub struct BlockType {
    pub block_type: u8,
}

impl BlockType {
    pub fn new(block_type: u8) -> Self {
        Self { block_type }
    }

    pub fn from_int(data: u8) -> Self {
        Self::new(data)
    }

    pub fn to_int(&self) -> u8 {
        self.block_type
    }
}
