using SpacetimeDB;

public static partial class Module
{

    static int[] defaultColorPalette = [
        0xfdcbb0,
        0xfca790,
        0xf68181,
        0xf04f78,
        0xc32454,
        0x831c5d,
        0xed8099,
        0xcf657f,
        0xa24b6f,
        0x753c54,
        0xeaaded,
        0xa884f3,
        0x905ea9,
        0x6b3e75,
        0x45293f,
        0x8fd3ff,
        0x4d9be6,
        0x4d65b4,
        0x484a77,
        0x323353,
        0x8ff8e2,
        0x30e1b9,
        0x0eaf9b,
        0x0b8a8f,
        0x0b5e65,
        0xb2ba90,
        0x92a984,
        0x547e64,
        0x374e4a,
        0x313638,
        0xcddf6c,
        0x91db69,
        0x1ebc73,
        0x239063,
        0x165a4c,
        0xfbff86,
        0xd5e04b,
        0xa2a947,
        0x676633,
        0x4c3e24,
        0xfbb954,
        0xe6904e,
        0xcd683d,
        0x9e4539,
        0x7a3045,
        0xf9c22b,
        0xf79617,
        0xfb6b1d,
        0xe83b3b,
        0xae2334,
        0xf57d4a,
        0xea4f36,
        0xb33831,
        0x6e2727,
        0xffffff,
        0xc7dcd0,
        0x9babb2,
        0x7f708a,
        0x694f62,
        0xab947a,
        0x966c6c,
        0x625565,
        0x3e3546,
        0x2e222f,
    ];

    [Reducer]
    public static void InitializeBlocks(ReducerContext ctx, string projectId)
    {
        EnsureAccessToProject.Check(ctx, projectId, ctx.Sender);

        ProjectBlocks blocks = new() { ProjectId = projectId, FaceColors = new int[defaultColorPalette.Length][] };
        for (int i = 0; i < defaultColorPalette.Length; i++)
        {
            var c = defaultColorPalette[i];
            blocks.FaceColors[i] = [c, c, c, c, c, c];
        }

        ctx.Db.project_blocks.Insert(blocks);
    }
}