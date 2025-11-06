using SpacetimeDB;
using SpacetimeDB.Internal.TableHandles;

public static partial class Module
{
#pragma warning disable STDB_UNSTABLE
    //     [SpacetimeDB.ClientVisibilityFilter]
    //     public static readonly Filter USER_PROJECTS_FILTER = new Filter.Sql(
    //         "SELECT * FROM user_projects WHERE user_projects.User = :sender"
    //     );

    //     [SpacetimeDB.ClientVisibilityFilter]
    //     public static readonly Filter PROJECT_FILTER = new Filter.Sql(
    //        "SELECT projects.* FROM projects JOIN user_projects ON user_projects.ProjectId = projects.Id"
    //    );

    //     [SpacetimeDB.ClientVisibilityFilter]
    //     public static readonly Filter PLAYER_CURSOR_FILTER = new Filter.Sql(
    //         "SELECT player_cursor.* FROM player_cursor JOIN user_projects ON user_projects.ProjectId = player_cursor.ProjectId"
    //     );

    //     [SpacetimeDB.ClientVisibilityFilter]
    //     public static readonly Filter LAYER_FILTER = new Filter.Sql(
    //         "SELECT layer.* FROM layer JOIN user_projects ON user_projects.ProjectId = layer.ProjectId"
    //     );

    //     [SpacetimeDB.ClientVisibilityFilter]
    //     public static readonly Filter BLOCK_FILTER = new Filter.Sql(
    //         "SELECT project_blocks.* FROM project_blocks JOIN user_projects ON user_projects.ProjectId = project_blocks.ProjectId"
    //     );

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
        public bool Visible;
        public bool Locked;
        public string Name;

        public static Layer Build(string projectId, int xDim, int yDim, int zDim, int index)
        {
            return new Layer
            {
                Id = IdGenerator.Generate("lyr"),
                ProjectId = projectId,
                xDim = xDim,
                yDim = yDim,
                zDim = zDim,
                Index = index,
                Visible = true,
                Locked = false,
                Name = $"Layer {index}"
            };
        }
    }

    [Table(Name = "chunk", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "chunk_project", Columns = new[] { nameof(ProjectId) })]
    [SpacetimeDB.Index.BTree(Name = "chunk_layer", Columns = new[] { nameof(LayerId) })]
    [SpacetimeDB.Index.BTree(Name = "chunk_layer_pos", Columns = new[] { nameof(LayerId), nameof(MinPosX), nameof(MinPosY), nameof(MinPosZ) })]
    public partial class Chunk
    {
        [PrimaryKey]
        public string Id;
        public string ProjectId;
        public string LayerId;
        public int MinPosX;
        public int MinPosY;
        public int MinPosZ;
        public int SizeX;
        public int SizeY;
        public int SizeZ;
        // RLE then LZ4 compressed voxel data. When decompressed, each voxel is a block index.
        public byte[] Voxels = [];

        public static Chunk Build(string projectId, string layerId, Vector3 minPos, Vector3 size)
        {
            var totalVoxels = size.X * size.Y * size.Z;
            var voxels = new byte[totalVoxels];

            return new Chunk
            {
                Id = IdGenerator.Generate("chk"),
                ProjectId = projectId,
                LayerId = layerId,
                MinPosX = minPos.X,
                MinPosY = minPos.Y,
                MinPosZ = minPos.Z,
                SizeX = size.X,
                SizeY = size.Y,
                SizeZ = size.Z,
                Voxels = VoxelCompression.Compress(voxels)
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


    [Table(Name = "selections", Public = true)]
    [SpacetimeDB.Index.BTree(Columns = new[] { nameof(Identity), nameof(ProjectId) })]
    public partial class Selection
    {
        [PrimaryKey]
        public string Id;

        public Identity Identity;

        public string ProjectId;

        public int Layer;

        // Compressed RLE then LZ4
        // A 1 indexed mapping of selected blocks and where they are now. The index
        // at a given point is where the block has been moved to. Needs to be one indexed 
        // so that we can indicate that 0 means no movement. Otherwise we'd have to use 
        // -1 which would halve the max world size. 
        public byte[] SelectionData;
    }


    /// <summary>
    /// BlockType is now simply a block index (byte).
    /// Voxel data is no longer bit-packed.
    /// Each voxel is 8 bits, allowing up to 256 different block types.
    /// </summary>
    public class BlockType
    {
        public byte Type;

        public BlockType(byte type)
        {
            Type = type;
        }

        public static BlockType FromInt(byte data)
        {
            return new BlockType(data);
        }

        public byte ToInt()
        {
            return Type;
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
        Attach,
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