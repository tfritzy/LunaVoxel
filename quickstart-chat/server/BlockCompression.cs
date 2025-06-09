using SpacetimeDB;
using static Module;

public static class BlockCompression
{
    public static List<BlockRun> Compress(Block?[,,] blocks)
    {
        bool[,,] visited = new bool[blocks.GetLength(0), blocks.GetLength(1), blocks.GetLength(2)];
        List<BlockRun> runs = [];
        int seeker = 0;
        int end = blocks.GetLength(0) * blocks.GetLength(1) * blocks.GetLength(2);

        while (seeker < end)
        {

            int y = seeker % blocks.GetLength(1);
            int z = (seeker / blocks.GetLength(1)) % blocks.GetLength(2);
            int x = seeker / (blocks.GetLength(1) * blocks.GetLength(2));
            seeker++;

            if (visited[x, y, z])
            {
                continue;
            }
            visited[x, y, z] = true;

            Block? block = blocks[x, y, z];
            if (block == null)
            {
                continue;
            }

            Vector3 position = new(x, y, z);
            BlockRun newRun = new(block.Type, position, position, block.Color);


            while (
                newRun.BottomRight.Y + 1 < blocks.GetLength(1) &&
                blocks[x, newRun.BottomRight.Y + 1, z]?.Type == block.Type &&
                blocks[x, newRun.BottomRight.Y + 1, z]?.Color == block.Color)
            {
                newRun.BottomRight.Y += 1;
                visited[x, newRun.BottomRight.Y, z] = true;
            }


            while (newRun.BottomRight.Z + 1 < blocks.GetLength(2))
            {
                bool allSame = true;
                for (int i = newRun.TopLeft.Y; i <= newRun.BottomRight.Y; i++)
                {
                    int testZ = newRun.BottomRight.Z + 1;
                    if (blocks[x, i, testZ]?.Type != block.Type || blocks[x, i, testZ]?.Color != block.Color)
                    {
                        allSame = false;
                        break;
                    }
                }

                if (!allSame)
                {
                    break;
                }

                newRun.BottomRight.Z += 1;
                for (int i = newRun.TopLeft.Y; i <= newRun.BottomRight.Y; i++)
                {
                    visited[x, i, newRun.BottomRight.Z] = true;
                }
            }


            while (newRun.BottomRight.X + 1 < blocks.GetLength(0))
            {
                bool allSame = true;
                for (int i = newRun.TopLeft.Y; i <= newRun.BottomRight.Y; i++)
                {
                    for (int j = newRun.TopLeft.Z; j <= newRun.BottomRight.Z; j++)
                    {
                        if (blocks[newRun.BottomRight.X + 1, i, j]?.Type != block.Type ||
                            blocks[newRun.BottomRight.X + 1, i, j]?.Color != block.Color)
                        {
                            allSame = false;
                            break;
                        }
                    }
                    if (!allSame) break;
                }

                if (!allSame)
                {
                    break;
                }

                newRun.BottomRight.X += 1;
                for (int i = newRun.TopLeft.Y; i <= newRun.BottomRight.Y; i++)
                {
                    for (int j = newRun.TopLeft.Z; j <= newRun.BottomRight.Z; j++)
                    {
                        visited[newRun.BottomRight.X, i, j] = true;
                    }
                }
            }

            runs.Add(newRun);
        }

        return runs;
    }

    public static Block?[,,] Decompress(IEnumerable<BlockRun> runs, int xSize, int ySize, int zSize)
    {
        Block?[,,] blocks = new Block?[xSize, ySize, zSize];

        foreach (var run in runs)
        {
            var block = new Block(run.Type, run.Color);
            for (int x = run.TopLeft.X; x <= run.BottomRight.X; x++)
            {
                for (int y = run.TopLeft.Y; y <= run.BottomRight.Y; y++)
                {
                    for (int z = run.TopLeft.Z; z <= run.BottomRight.Z; z++)
                    {
                        blocks[x, y, z] = block;
                    }
                }
            }
        }

        return blocks;
    }
}