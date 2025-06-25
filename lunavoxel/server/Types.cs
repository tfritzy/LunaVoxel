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

    [Table(Name = "chunk", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "chunk_project", Columns = new[] { nameof(ProjectId) })]
    public partial class Chunk
    {
        [PrimaryKey]
        public string Id;
        public string ProjectId;
        public int xDim;
        public int yDim;
        public int zDim;
        public int Layer;
        public BlockRun[] Blocks = System.Array.Empty<BlockRun>();

        public static Chunk Build(string projectId, int xDim, int yDim, int zDim, int layer)
        {
            return new Chunk
            {
                Id = $"{projectId}_{layer}",
                ProjectId = projectId,
                xDim = xDim,
                yDim = yDim,
                zDim = zDim,
                Blocks = System.Array.Empty<BlockRun>(),
                Layer = layer
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

    [Type]
    public partial struct BlockRun
    {
        public MeshType Type;
        public int? Color;
        public Vector3 TopLeft;
        public Vector3 BottomRight;

        public BlockRun(MeshType type, Vector3 topLeft, Vector3 bottomRight, int? color = null)
        {
            this.Type = type;
            this.Color = color;
            this.TopLeft = topLeft;
            this.BottomRight = bottomRight;
        }
    }

    public class Block
    {
        public MeshType Type;
        public int? Color;

        public Block(MeshType type, int? color = null)
        {
            this.Type = type;
            this.Color = color;
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
    public enum MeshType
    {
        Block,
        RoundBlock
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