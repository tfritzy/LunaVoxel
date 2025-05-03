public static class IdGenerator
{
    public static string Generate(string prefix)
    {
        string id = Guid.NewGuid().ToString("N").Substring(0, 12);
        return $"{prefix}_{id}";
    }
}