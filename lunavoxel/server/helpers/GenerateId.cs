public static class IdGenerator
{
    public static string Generate(string prefix)
    {
        string id = Guid.NewGuid().ToString("N");
        return $"{prefix}_{id}";
    }
}