using SpacetimeDB;
using SpacetimeDB.Internal.TableHandles;

public static partial class Module
{
#pragma warning disable STDB_UNSTABLE

    [SpacetimeDB.ClientVisibilityFilter]
    public static readonly Filter PROJECT_FILTER = new Filter.Sql(
        "SELECT p.* FROM projects p JOIN user_projects up ON p.Id = up.ProjectId WHERE up.User = :sender"
    );

    [Table(Name = "projects", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "idx_owner_last_visited",
                             Columns = new[] { nameof(Owner), nameof(LastVisited) })]
    public partial class Project
    {
        [PrimaryKey]
        public string Id;
        public string Name;
        public Vector3 Dimensions;
        public Identity Owner;
        public Timestamp LastVisited;
        public AccessType PublicAccess;

        public static Project Build(string id, string name, int xDim, int yDim, int zDim, Identity owner, Timestamp timestamp)
        {
            return new Project
            {
                Id = id,
                Name = name,
                Dimensions = new Vector3(xDim, yDim, zDim),
                Owner = owner,
                LastVisited = timestamp,
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

    [Table(Name = "color_palette", Public = true)]
    public partial class ColorPalette
    {
        [PrimaryKey]
        public string ProjectId;
        public int[] Colors = [];
    }

    [Table(Name = "atlas", Public = true)]
    public partial class Atlas
    {
        [PrimaryKey]
        public string ProjectId;
        public int Version;
        public int CellPixelWidth;
        public int PixelWidth => CellPixelWidth * GridSize;
        public int GridSize;
        public int SlotCount => GridSize * GridSize;
        public int UsedSlots;
    }

    [Table(Name = "project_blocks", Public = true)]
    public partial class ProjectBlocks
    {
        [PrimaryKey]
        public string ProjectId;
        public int[][] BlockFaceAtlasIndexes = []; // 2d array of block faces, each face is an index in the atlas
    }

    [Table(Name = "player_cursor", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "player_cursor_project", Columns = new[] { nameof(ProjectId) })]
    [SpacetimeDB.Index.BTree(Name = "player_cursor_project_player", Columns = new[] { nameof(ProjectId), nameof(Player) })]
    public partial class PlayerCursor
    {
        [PrimaryKey]
        public string Id;
        public string ProjectId;
        public Identity Player;
        public Vector3Float Position;
        public Vector3Float Normal;
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
        public byte[] Voxels = [];
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
                Voxels = VoxelRLE.Compress(new byte[xDim * yDim * zDim * 2]),
                Visible = true,
                Locked = false,
                Name = $"Layer {index}"
            };
        }
    }

    [Table(Name = "layer_history_entry", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "author_head", Columns = new[] { nameof(Author), nameof(IsHead) })]
    [SpacetimeDB.Index.BTree(Name = "project", Columns = new[] { nameof(ProjectId) })]
    [SpacetimeDB.Index.BTree(Name = "author_undone", Columns = new[] { nameof(Author), nameof(IsUndone) })]
    public partial class LayerHistoryEntry
    {
        [PrimaryKey]
        public string Id;
        public string ProjectId;
        public Identity Author;
        [AutoInc]
        public ulong Version;
        public bool IsHead; // Is the current edit the author is on.
        public bool IsUndone; // Is not being applied to the scene.
        public string LayerId;
        public byte[] BeforeVoxels = [];
        public byte[] DiffVoxels = [];
        public bool IsBaseState;

        public static LayerHistoryEntry Build(
            string projectId,
            Identity author,
            string layerId,
            byte[] beforeVoxels,
            byte[] diffVoxels,
            bool isHead)
        {
            return new LayerHistoryEntry
            {
                Id = IdGenerator.Generate("lhe"),
                ProjectId = projectId,
                Author = author,
                Version = 0,
                IsHead = isHead,
                LayerId = layerId,
                BeforeVoxels = beforeVoxels,
                DiffVoxels = diffVoxels,
                IsUndone = false,
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
        public int Type;
        public int Rotation;

        public BlockType(int type, int rotation = 0)
        {
            Type = type;
            Rotation = rotation;
        }

        public static BlockType FromBytes(byte[] data)
        {
            if (data.Length != 2)
                throw new ArgumentException("Invalid block data length");

            ushort combined = (ushort)((data[0] << 8) | data[1]);

            ushort type = (ushort)(combined >> 6);
            byte rotation = (byte)(combined & 0x07);

            return new BlockType(type, rotation);
        }

        public byte[] ToBytes()
        {
            ushort combined = (ushort)((Type << 6) | (Rotation & 0x07));

            return
            [
                (byte)(combined >> 8),
                (byte)(combined & 0xFF)
            ];
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