using SpacetimeDB;
using SpacetimeDB.Internal.TableHandles;

public static partial class Module
{
#pragma warning disable STDB_UNSTABLE

    // [SpacetimeDB.ClientVisibilityFilter]
    // public static readonly Filter PROJECT_FILTER = new Filter.Sql(
    //     "SELECT p.* FROM projects p JOIN user_projects up ON p.Id = up.ProjectId WHERE up.User = :sender"
    // );

    [Table(Name = "projects", Public = true)]
    public partial class Project
    {
        [PrimaryKey]
        public string Id;
        public string Name;
        public Vector3 Dimensions;
        public Identity Owner;
        public Timestamp Updated;
        public Timestamp Created;
        public AccessType PublicAccess;

        public static Project Build(string id, string name, int xDim, int yDim, int zDim, Identity owner, Timestamp now)
        {
            return new Project
            {
                Id = id,
                Name = name,
                Dimensions = new Vector3(xDim, yDim, zDim),
                Owner = owner,
                Updated = now,
                Created = now,
                PublicAccess = AccessType.None
            };
        }
    }

    [Table(Name = "user_projects", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "idx_user_project", Columns = new[] { nameof(ProjectId), nameof(User) })]
    [SpacetimeDB.Index.BTree(Name = "idx_project_id_email", Columns = new[] { nameof(ProjectId), nameof(Email) })]
    [SpacetimeDB.Index.BTree(Name = "idx_project_id_only", Columns = new[] { nameof(ProjectId) })]
    [SpacetimeDB.Index.BTree(Name = "idx_user_email", Columns = new[] { nameof(User), nameof(Email) })]
    [SpacetimeDB.Index.BTree(Name = "idx_user_only", Columns = new[] { nameof(User) })]
    public partial class UserProject
    {
        [PrimaryKey]
        public string Id;
        public string ProjectId;
        public AccessType AccessType;
        public Identity User;
        public string? Email;

        public static UserProject Build(Identity user, string projectId, AccessType accessType, string? email, string? id = null)
        {
            return new UserProject
            {
                Id = id ?? IdGenerator.Generate("up"),
                User = user,
                ProjectId = projectId,
                AccessType = accessType,
                Email = email,
            };
        }
    }

    [Table(Name = "project_blocks", Public = true)]
    public partial class ProjectBlocks
    {
        [PrimaryKey]
        public string ProjectId;
        public int[][] FaceColors = []; // Array of 6 hex codes, for the color of each face
    }

    [Table(Name = "player_cursor", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "player_cursor_project", Columns = new[] { nameof(ProjectId) })]
    [SpacetimeDB.Index.BTree(Name = "player_cursor_project_player", Columns = new[] { nameof(ProjectId), nameof(Player) })]
    [SpacetimeDB.Index.BTree(Name = "player_cursor_player", Columns = new[] { nameof(Player) })]
    public partial class PlayerCursor
    {
        [PrimaryKey]
        public string Id;
        public string ProjectId;
        public string DisplayName;
        public Identity Player;
        public Vector3Float? Position;
        public Vector3Float? Normal;
        public Timestamp LastUpdated;
    }

    [Table(Name = "layer", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "layer_project", Columns = new[] { nameof(ProjectId) })]
    [SpacetimeDB.Index.BTree(Name = "project_index", Columns = new[] { nameof(ProjectId), nameof(Index) })]
    public partial class Layer
    {
        [PrimaryKey]
        public string Id;
        public string ProjectId;
        public int xDim;
        public int yDim;
        public int zDim;
        public int Index;
        // Compressed format: byte array with 6-byte groups [vL0, vL1, vH0, vH1, rL0, rL1]
        // Where each voxel is a 32-bit int split into bytes:
        // vL0, vL1: lower 16 bits of voxel data (little-endian)
        // vH0, vH1: upper 16 bits of voxel data (little-endian)
        // rL0, rL1: 16-bit run length for RLE compression (little-endian)
        //
        // Voxel format (32-bit int when decompressed):
        // Byte 1: [NA_15][NA_14][NA_13][NA_12][NA_11][NA_10][NA_9][NA_8]
        // Byte 2: [VERSION_7][VERSION_6][VERSION_5][VERSION_4][VERSION_3][VERSION_2][VERSION_1][VERSION_0]
        // Byte 3: [TYPE_9][TYPE_8][TYPE_7][TYPE_6][TYPE_5][TYPE_4][TYPE_3][TYPE_2] 
        // Byte 4: [TYPE_1][TYPE_0][IS_PREVIEW][UNUSED][UNUSED][ROT_2][ROT_1][ROT_0]
        // note: Is preview is only used client side
        public byte[] Voxels = [];
        public bool Visible;
        public bool Locked;
        public string Name;

        public static Layer Build(string projectId, int xDim, int yDim, int zDim, int index)
        {
            uint empty = VoxelDataUtils.EncodeBlockData(0, 0, 1);
            var voxels = new uint[xDim * yDim * zDim];
            Array.Fill(voxels, empty);

            return new Layer
            {
                Id = IdGenerator.Generate("lyr"),
                ProjectId = projectId,
                xDim = xDim,
                yDim = yDim,
                zDim = zDim,
                Index = index,
                Voxels = VoxelCompression.Compress(voxels),
                Visible = true,
                Locked = false,
                Name = $"Layer {index}"
            };
        }
    }

    [Table(Name = "user", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "email", Columns = new[] { nameof(Email) })]
    public partial class User
    {
        [PrimaryKey]
        public Identity Identity;
        public string? Email;
        public string? Name;
    }

    public class BlockType
    {
        public uint Type;
        public uint Rotation;
        public uint Version;

        public BlockType(uint type, uint version, uint rotation)
        {
            Type = type;
            Version = version;
            Rotation = rotation;
        }

        public static BlockType FromInt(uint data)
        {
            uint type = VoxelDataUtils.GetBlockType(data);
            uint version = VoxelDataUtils.GetVersion(data);
            uint rotation = VoxelDataUtils.GetRotation(data);
            return new BlockType(type, version, rotation);
        }

        public uint ToInt()
        {
            return VoxelDataUtils.EncodeBlockData(Type, Version, Rotation);
        }
    }

    [Type]
    public partial struct Vector3(int x, int y, int z)
    {
        public int X = x;
        public int Y = y;
        public int Z = z;
    }

    [Type]
    public partial struct Vector3Float(float x, float y, float z)
    {
        public float X = x;
        public float Y = y;
        public float Z = z;
    }

    [Type]
    public enum BlockModificationMode
    {
        Build,
        Erase,
        Paint
    }

    [Type]
    public enum AccessType
    {
        None,
        Inherited,
        Read,
        ReadWrite,
    }
}