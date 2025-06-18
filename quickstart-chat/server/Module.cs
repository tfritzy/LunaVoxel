using System.Linq;
using SpacetimeDB;

public static partial class Module
{
    private static bool IsValidHexColor(int color)
    {
        return color >= 0 && color <= 0xffffff;
    }
}
