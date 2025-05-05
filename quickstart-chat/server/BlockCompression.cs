using static Module;

public static class BlockCompression
{
    public static void SetBlock(ref Block[] blocks, BlockType blockType, int z, bool ghost)
    {
        int i = 0;
        int zIter = 0;

        while (i < blocks.Length)
        {
            if (zIter + blocks[i].Count > z)
                break;

            zIter += blocks[i].Count;
            i++;
        }

        if (i >= blocks.Length)
            return;

        if (blocks[i].Type == blockType && blocks[i].Ghost == ghost)
            return;

        int offset = z - zIter;

        List<Block> newBlocks = [];

        for (int j = 0; j < i; j++)
        {
            newBlocks.Add(blocks[j]);
        }

        if (offset > 0)
        {
            newBlocks.Add(new Block(blocks[i].Type, offset, blocks[i].Ghost));
        }

        newBlocks.Add(new Block(blockType, 1, ghost));

        int remainingCount = blocks[i].Count - offset - 1;
        if (remainingCount > 0)
        {
            newBlocks.Add(new Block(blocks[i].Type, remainingCount, blocks[i].Ghost));
        }

        for (int j = i + 1; j < blocks.Length; j++)
        {
            newBlocks.Add(blocks[j]);
        }

        i = 0;
        while (i < newBlocks.Count - 1)
        {
            if (newBlocks[i].Type == newBlocks[i + 1].Type &&
                newBlocks[i].Ghost == newBlocks[i + 1].Ghost)
            {
                newBlocks[i] = new Block(
                    newBlocks[i].Type,
                    newBlocks[i].Count + newBlocks[i + 1].Count,
                    newBlocks[i].Ghost
                );
                newBlocks.RemoveAt(i + 1);
            }
            else
            {
                i++;
            }
        }

        Array.Resize(ref blocks, newBlocks.Count);
        for (i = 0; i < newBlocks.Count; i++)
        {
            blocks[i] = newBlocks[i];
        }
    }
}