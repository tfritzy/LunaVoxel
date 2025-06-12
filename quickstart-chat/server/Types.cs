using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "World", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "idx_owner_last_visited",
                             Columns = new[] { nameof(Owner), nameof(LastVisited) })]
    public partial class World
    {
        [PrimaryKey]
        public string Id;
        public string Name;
        public int XWidth;
        public int ZWidth;
        public int Height;
        public Identity Owner;
        public Timestamp LastVisited;

        public static World Build(string id, string name, int xWidth, int zWidth, int height, Identity owner,
                                  Timestamp timestamp)
        {
            return new World
            {
                Id = id,
                Name = name,
                XWidth = xWidth,
                ZWidth = zWidth,
                Height = height,
                Owner = owner,
                LastVisited = timestamp
            };
        }
    }

    [Table(Name = "PlayerInWorld", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "player_world", Columns = new[] { nameof(Player), nameof(World) })]
    [SpacetimeDB.Index.BTree(Name = "world_color",
                             Columns = new[] { nameof(World), nameof(SelectedColor) })]
    public partial class PlayerInWorld
    {
        [PrimaryKey]
        public string Id;
        public Identity Player;
        public string World;
        public string SelectedColor;
    }

    [Table(Name = "PreviewVoxels", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "player_world",
                             Columns = new[] { nameof(Player), nameof(World) })]
    public partial class PreviewVoxels
    {
        [PrimaryKey]
        public string Id;
        public Identity Player;
        public string World;
        public BlockRun[] PreviewPositions = System.Array.Empty<BlockRun>();
        public Vector3 StartPos;
        public string? BlockColor;
        public bool IsAddMode;
    }

    [Table(Name = "ColorPalette", Public = true)]
    public partial class ColorPalette
    {
        [PrimaryKey]
        public string World;
        public string[] Colors;
    }

    [Type]
    public partial struct BlockRun
    {
        public MeshType Type;
        public string? Color;
        public Vector3 TopLeft;
        public Vector3 BottomRight;

        public BlockRun(MeshType type, Vector3 topLeft, Vector3 bottomRight, string? color = null)
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
        public string? Color;

        public Block(MeshType type, string? color = null)
        {
            this.Type = type;
            this.Color = color;
        }
    }

    [Type]
    public partial struct Vector3
    (int x, int y, int z)
    {
        public int X = x;
        public int Y = y;
        public int Z = z;
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

    [Table(Name = "Chunk", Public = true)]
    [SpacetimeDB.Index.BTree(Name = "chunk_world", Columns = new[] { nameof(World) })]
    public partial class Chunk
    {
        [PrimaryKey]
        public string Id;
        public string World;
        public int xDim;
        public int yDim;
        public int zDim;
        public int Layer;
        public BlockRun[] Blocks = System.Array.Empty<BlockRun>();

        public static Chunk Build(string world, int xDim, int yDim, int zDim, int layer)
        {
            return new Chunk
            {
                Id = $"{world}_{layer}",
                World = world,
                xDim = xDim,
                yDim = yDim,
                zDim = zDim,
                Blocks = System.Array.Empty<BlockRun>(),
                Layer = layer
            };
        }
    }
}
