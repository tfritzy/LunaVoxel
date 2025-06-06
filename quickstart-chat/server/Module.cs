using SpacetimeDB;
using System.Linq;

public static partial class Module
{
    public const string COLOR_ID_PREFIX = "idx";

    public static string GetPlayerColor(string selectedColor, ColorPalette palette)
    {
        if (selectedColor.StartsWith(COLOR_ID_PREFIX))
        {
            int index = int.Parse(selectedColor.Split(COLOR_ID_PREFIX)[1]);
            if (palette.Colors == null || palette.Colors.Length == 0)
            {
                return "#FFFFFF";
            }
            return palette.Colors[index % palette.Colors.Length];
        }
        else
        {
            return selectedColor;
        }
    }

    private static bool IsValidHexColor(string color)
    {
        if (string.IsNullOrWhiteSpace(color) || color.Length != 7 || !color.StartsWith("#"))
        {
            return false;
        }

        return color.Substring(1).All(c => (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));
    }
}
