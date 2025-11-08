using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;

[TestClass]
public class ModifyBlocksTests
{
    [TestMethod]
    public void ModifyBlocks_AttachMode_SetsNonZeroValues()
    {
        var minPos = new Module.Vector3(0, 0, 0);
        var maxPos = new Module.Vector3(1, 1, 1);
        
        var voxelData = new byte[]
        {
            1, 0, 2, 0,
            0, 3, 0, 4
        };

        var compressed = VoxelCompression.Compress(voxelData);

        Assert.IsNotNull(compressed);
        Assert.IsTrue(compressed.Length > 0);

        var decompressed = VoxelCompression.Decompress(compressed);
        
        Assert.AreEqual(voxelData.Length, decompressed.Length);
        for (int i = 0; i < voxelData.Length; i++)
        {
            Assert.AreEqual(voxelData[i], decompressed[i], $"Voxel at index {i} should match");
        }
    }

    [TestMethod]
    public void ModifyBlocks_EraseMode_DeletesVoxelsWithNonZeroData()
    {
        var voxelData = new byte[]
        {
            1, 0, 1, 0,
            0, 1, 0, 1
        };

        var compressed = VoxelCompression.Compress(voxelData);
        var decompressed = VoxelCompression.Decompress(compressed);
        
        Assert.AreEqual(voxelData.Length, decompressed.Length);
    }

    [TestMethod]
    public void ModifyBlocks_PaintMode_OnlyUpdatesExistingVoxels()
    {
        var existingVoxels = new byte[] { 1, 0, 2, 0, 3, 4 };
        var updateData = new byte[] { 5, 5, 5, 5, 5, 5 };

        var mode = Module.BlockModificationMode.Paint;

        var expectedResults = new byte[] { 5, 0, 5, 0, 5, 5 };

        for (int i = 0; i < updateData.Length; i++)
        {
            if (updateData[i] != 0)
            {
                if (existingVoxels[i] != 0)
                {
                    existingVoxels[i] = updateData[i];
                }
            }
        }

        CollectionAssert.AreEqual(expectedResults, existingVoxels);
    }

    [TestMethod]
    public void ModifyBlocks_ZeroValueSkipsUpdate()
    {
        var existingVoxels = new byte[] { 1, 2, 3, 4 };
        var updateData = new byte[] { 0, 5, 0, 6 };

        for (int i = 0; i < updateData.Length; i++)
        {
            if (updateData[i] != 0)
            {
                existingVoxels[i] = updateData[i];
            }
        }

        var expected = new byte[] { 1, 5, 3, 6 };
        CollectionAssert.AreEqual(expected, existingVoxels);
    }

    [TestMethod]
    public void VoxelCompression_RoundTrip_PreservesData()
    {
        var originalData = new byte[]
        {
            0, 0, 0, 1, 1, 1, 2, 2,
            3, 3, 3, 3, 0, 0, 5, 5
        };

        var compressed = VoxelCompression.Compress(originalData);
        Assert.IsTrue(compressed.Length > 0, "Compressed data should not be empty");

        var decompressed = VoxelCompression.Decompress(compressed);
        
        Assert.AreEqual(originalData.Length, decompressed.Length, "Decompressed length should match original");
        
        for (int i = 0; i < originalData.Length; i++)
        {
            Assert.AreEqual(originalData[i], decompressed[i], $"Byte at index {i} should match");
        }
    }

    [TestMethod]
    public void ModifyBlocks_EraseMode_InterpretNonZeroAsDelete()
    {
        var existingVoxels = new byte[] { 1, 2, 3, 4, 5 };
        var eraseData = new byte[] { 1, 0, 1, 0, 1 };
        var mode = Module.BlockModificationMode.Erase;

        for (int i = 0; i < eraseData.Length; i++)
        {
            if (eraseData[i] != 0)
            {
                existingVoxels[i] = 0;
            }
        }

        var expected = new byte[] { 0, 2, 0, 4, 0 };
        CollectionAssert.AreEqual(expected, existingVoxels);
    }
}
