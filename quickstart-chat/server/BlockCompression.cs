using SpacetimeDB;
using static Module;

public static class BlockCompression
{
    // public static void SetBlock(ref BlockRun[] blocks, MeshType blockType, int z, string? color = null)
    // {
    //     int i = 0;
    //     int zIter = 0;

    //     while (i < blocks.Length)
    //     {
    //         if (zIter + blocks[i].Count > z)
    //             break;

    //         zIter += blocks[i].Count;
    //         i++;
    //     }

    //     if (i >= blocks.Length)
    //         return;

    //     if (blocks[i].Type == blockType && blocks[i].Color == color)
    //         return;

    //     int offset = z - zIter;

    //     List<BlockRun> newBlocks = new List<BlockRun>();

    //     for (int j = 0; j < i; j++)
    //     {
    //         newBlocks.Add(blocks[j]);
    //     }

    //     if (offset > 0)
    //     {
    //         newBlocks.Add(new BlockRun(blocks[i].Type, offset, blocks[i].Color));
    //     }

    //     newBlocks.Add(new BlockRun(blockType, 1, color));

    //     int remainingCount = blocks[i].Count - offset - 1;
    //     if (remainingCount > 0)
    //     {
    //         newBlocks.Add(new BlockRun(blocks[i].Type, remainingCount, blocks[i].Color));
    //     }

    //     for (int j = i + 1; j < blocks.Length; j++)
    //     {
    //         newBlocks.Add(blocks[j]);
    //     }

    //     i = 0;
    //     while (i < newBlocks.Count - 1)
    //     {
    //         if (newBlocks[i].Type == newBlocks[i + 1].Type &&
    //             newBlocks[i].Color == newBlocks[i + 1].Color)
    //         {
    //             newBlocks[i] = new BlockRun(
    //                 newBlocks[i].Type,
    //                 newBlocks[i].Count + newBlocks[i + 1].Count,
    //                 newBlocks[i].Color
    //             );
    //             newBlocks.RemoveAt(i + 1);
    //         }
    //         else
    //         {
    //             i++;
    //         }
    //     }

    //     Array.Resize(ref blocks, newBlocks.Count);
    //     for (i = 0; i < newBlocks.Count; i++)
    //     {
    //         blocks[i] = newBlocks[i];
    //     }
    // }

    // public static Block? GetBlock(BlockRun[] blocks, int z)
    // {
    //     int zIter = 0;
    //     foreach (var block in blocks)
    //     {
    //         if (zIter + block.Count > z)
    //         {
    //             return (block.Type, block.Color);
    //         }
    //         zIter += block.Count;
    //     }

    //     return (default(MeshType), "#FFFFFF");
    // }

    public static List<BlockRun> Compress(Block?[,,] blocks)
    {
        bool[,,] visited = new bool[blocks.GetLength(0), blocks.GetLength(1), blocks.GetLength(2)];
        List<BlockRun> runs = [];
        int seeker = 0;
        int end = blocks.GetLength(0) * blocks.GetLength(1) * blocks.GetLength(2);

        while (seeker < end)
        {
            int z = seeker % blocks.GetLength(2);
            int y = (seeker / blocks.GetLength(2)) % blocks.GetLength(1);
            int x = seeker / (blocks.GetLength(2) * blocks.GetLength(1));
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
                newRun.BottomRight.X + 1 < blocks.GetLength(0) &&
                blocks[newRun.BottomRight.X + 1, y, z]?.Type == block.Type &&
                blocks[newRun.BottomRight.X + 1, y, z]?.Color == block.Color)
            {
                newRun.BottomRight.X += 1;
                visited[newRun.BottomRight.X, y, z] = true;
            }

            while (newRun.BottomRight.Y + 1 < blocks.GetLength(1))
            {
                bool allSame = true;
                for (int i = newRun.TopLeft.X; i <= newRun.BottomRight.X; i++)
                {
                    int testY = newRun.BottomRight.Y + 1;
                    if (blocks[i, testY, z]?.Type != block.Type || blocks[i, testY, z]?.Color != block.Color)
                    {
                        allSame = false;
                        break;
                    }
                }

                if (!allSame)
                {
                    break;
                }

                newRun.BottomRight.Y += 1;
                for (int i = newRun.TopLeft.X; i <= newRun.BottomRight.X; i++)
                {
                    visited[i, newRun.BottomRight.Y, z] = true;
                }
            }

            while (newRun.BottomRight.Z + 1 < blocks.GetLength(2))
            {
                bool allSame = true;
                for (int i = newRun.TopLeft.X; i <= newRun.BottomRight.X; i++)
                {
                    for (int j = newRun.TopLeft.Y; j <= newRun.BottomRight.Y; j++)
                    {
                        if (blocks[i, j, newRun.BottomRight.Z + 1]?.Type != block.Type ||
                            blocks[i, j, newRun.BottomRight.Z + 1]?.Color != block.Color)
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

                newRun.BottomRight.Z += 1;
                for (int i = newRun.TopLeft.X; i <= newRun.BottomRight.X; i++)
                {
                    for (int j = newRun.TopLeft.Y; j <= newRun.BottomRight.Y; j++)
                    {
                        visited[i, j, newRun.BottomRight.Z] = true;
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