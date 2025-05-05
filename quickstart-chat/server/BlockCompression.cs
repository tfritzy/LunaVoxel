using static Module;

public static class BlockCompression
{
    public static void SetBlock(Block[] blocks, BlockType blockType, int z)
    {
        // stone 4, dirt 3, empty 20, leaf 2 empty 120
        // set 12 to dirt
        // zIter = 0, i = 0
        // zIter = 4, i = 1
        // zIter = 7, i = 2
        // zIter = 27, i = 3 !!
        // Take index two, and split into empty 4, and 
        int i = 0;
        int zIter = 0;
        while (zIter < z && i < blocks.Length)
        {
            zIter += blocks[i].Count;
            i += 1;
        }
    }
}