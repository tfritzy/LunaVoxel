using SpacetimeDB;
using System.Collections.Generic;

public static partial class Module
{
    [Reducer]
    public static void
    ModifyBlockRect(ReducerContext ctx, string world, BlockModificationMode mode, MeshType type, int x1, int y1, int z1,
                    int x2, int y2, int z2, bool isPreview = false)
    {
        List<Vector3> positions = new List<Vector3>();
        for (int x = x1; x < x2; x++)
        {
            for (int y = y1; y < y2; y++)
            {
                for (int z = z1; z < z2; z++)
                {
                    positions.Add(new Vector3(x, y, z));
                }
            }
        }
        ModifyBlock(ctx, world, mode, type, positions, isPreview);
    }
}
