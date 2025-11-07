using Microsoft.VisualStudio.TestTools.UnitTesting;

[TestClass]
public class DeleteBlockTests
{
    [TestMethod]
    public void UpdateVoxelsForDeletedBlock_ReplacesDeletedBlockIndex()
    {
        byte[] voxels = new byte[] { 0, 1, 2, 3, 2, 1, 0 };
        int deletedBlockIndex = 2;
        byte replacementBlockType = 0;

        UpdateVoxelsForDeletedBlock(voxels, deletedBlockIndex, replacementBlockType);

        Assert.AreEqual(0, voxels[0], "Block 0 should remain unchanged");
        Assert.AreEqual(1, voxels[1], "Block 1 should remain unchanged");
        Assert.AreEqual(0, voxels[2], "Block 2 should be replaced with 0");
        Assert.AreEqual(2, voxels[3], "Block 3 should be decremented to 2");
        Assert.AreEqual(0, voxels[4], "Block 2 should be replaced with 0");
        Assert.AreEqual(1, voxels[5], "Block 1 should remain unchanged");
        Assert.AreEqual(0, voxels[6], "Block 0 should remain unchanged");
    }

    [TestMethod]
    public void UpdateVoxelsForDeletedBlock_WithDifferentReplacement()
    {
        byte[] voxels = new byte[] { 5, 10, 15, 10, 20 };
        int deletedBlockIndex = 10;
        byte replacementBlockType = 3;

        UpdateVoxelsForDeletedBlock(voxels, deletedBlockIndex, replacementBlockType);

        Assert.AreEqual(5, voxels[0], "Block 5 should remain unchanged");
        Assert.AreEqual(3, voxels[1], "Block 10 should be replaced with 3");
        Assert.AreEqual(14, voxels[2], "Block 15 should be decremented to 14");
        Assert.AreEqual(3, voxels[3], "Block 10 should be replaced with 3");
        Assert.AreEqual(19, voxels[4], "Block 20 should be decremented to 19");
    }

    [TestMethod]
    public void UpdateVoxelsForDeletedBlock_DeletesFirstBlock()
    {
        byte[] voxels = new byte[] { 1, 2, 3, 4, 5 };
        int deletedBlockIndex = 1;
        byte replacementBlockType = 0;

        UpdateVoxelsForDeletedBlock(voxels, deletedBlockIndex, replacementBlockType);

        Assert.AreEqual(0, voxels[0], "Block 1 should be replaced with 0");
        Assert.AreEqual(1, voxels[1], "Block 2 should be decremented to 1");
        Assert.AreEqual(2, voxels[2], "Block 3 should be decremented to 2");
        Assert.AreEqual(3, voxels[3], "Block 4 should be decremented to 3");
        Assert.AreEqual(4, voxels[4], "Block 5 should be decremented to 4");
    }

    [TestMethod]
    public void UpdateVoxelsForDeletedBlock_NoChangeWhenBlockNotPresent()
    {
        byte[] voxels = new byte[] { 1, 2, 3, 4 };
        int deletedBlockIndex = 10;
        byte replacementBlockType = 0;

        UpdateVoxelsForDeletedBlock(voxels, deletedBlockIndex, replacementBlockType);

        Assert.AreEqual(1, voxels[0], "Block 1 should remain unchanged");
        Assert.AreEqual(2, voxels[1], "Block 2 should remain unchanged");
        Assert.AreEqual(3, voxels[2], "Block 3 should remain unchanged");
        Assert.AreEqual(4, voxels[3], "Block 4 should remain unchanged");
    }

    [TestMethod]
    public void UpdateVoxelsForDeletedBlock_EmptyArray()
    {
        byte[] voxels = new byte[] { };
        int deletedBlockIndex = 1;
        byte replacementBlockType = 0;

        UpdateVoxelsForDeletedBlock(voxels, deletedBlockIndex, replacementBlockType);

        Assert.AreEqual(0, voxels.Length, "Empty array should remain empty");
    }

    [TestMethod]
    public void UpdateVoxelsForDeletedBlock_AllSameDeletedBlock()
    {
        byte[] voxels = new byte[] { 5, 5, 5, 5, 5 };
        int deletedBlockIndex = 5;
        byte replacementBlockType = 2;

        UpdateVoxelsForDeletedBlock(voxels, deletedBlockIndex, replacementBlockType);

        Assert.AreEqual(2, voxels[0], "All should be replaced with 2");
        Assert.AreEqual(2, voxels[1], "All should be replaced with 2");
        Assert.AreEqual(2, voxels[2], "All should be replaced with 2");
        Assert.AreEqual(2, voxels[3], "All should be replaced with 2");
        Assert.AreEqual(2, voxels[4], "All should be replaced with 2");
    }

    private void UpdateVoxelsForDeletedBlock(byte[] voxels, int deletedBlockIndex, byte replacementBlockType)
    {
        for (int i = 0; i < voxels.Length; i++)
        {
            byte voxelValue = voxels[i];
            
            if (voxelValue == deletedBlockIndex)
            {
                voxels[i] = replacementBlockType;
            }
            else if (voxelValue > deletedBlockIndex)
            {
                voxels[i] = (byte)(voxelValue - 1);
            }
        }
    }
}
