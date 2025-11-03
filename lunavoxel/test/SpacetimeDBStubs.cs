// Stub SpacetimeDB types for testing
namespace SpacetimeDB
{
    [AttributeUsage(AttributeTargets.Method)]
    public class ReducerAttribute : Attribute { }

    [AttributeUsage(AttributeTargets.Class)]
    public class TableAttribute : Attribute
    {
        public string? Name { get; set; }
        public bool Public { get; set; }
    }

    [AttributeUsage(AttributeTargets.Property | AttributeTargets.Field)]
    public class PrimaryKeyAttribute : Attribute { }

    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct | AttributeTargets.Enum)]
    public class TypeAttribute : Attribute { }

    public class ReducerContext
    {
        public Identity Sender { get; set; }
        public dynamic Db { get; set; } = null!;
        public Timestamp Timestamp { get; set; }
    }

    public struct Identity
    {
        public byte[] Bytes { get; set; }
        
        public string ToLower() => "";
    }

    public struct Timestamp
    {
        public long Milliseconds { get; set; }
    }

    public static class Log
    {
        public static void Info(string message) { }
        public static void Debug(string message) { }
        public static void Error(string message) { }
    }

    namespace Index
    {
        [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
        public class BTreeAttribute : Attribute
        {
            public string? Name { get; set; }
            public string[]? Columns { get; set; }
        }
    }

    namespace Internal.TableHandles
    {
        public class Filter
        {
            public class Sql
            {
                public Sql(string query) { }
            }
        }
    }
}

// Stub for IdGenerator
public static class IdGenerator
{
    public static string Generate(string prefix) => prefix + "_test";
}
