using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Linq;

[TestClass]
public class SelectionHelperTests
{
    [TestMethod]
    public void TestConvertGlobalArrayToFrames_SingleChunk()
    {
        // Create a small selection that fits in one chunk
        int xDim = 8, yDim = 8, zDim = 8;
        var selectionData = new byte[xDim * yDim * zDim];
        
        // Select a few voxels
        selectionData[0] = 1;   // (0,0,0)
        selectionData[9] = 1;   // (0,1,1)
        selectionData[16] = 1;  // (0,2,0)

        var frames = Module.SelectionHelper.ConvertGlobalArrayToFrames(selectionData, xDim, yDim, zDim);

        Assert.AreEqual(1, frames.Length, "Should create exactly 1 frame for a single chunk");
        Assert.AreEqual(0, frames[0].MinPos.X);
        Assert.AreEqual(0, frames[0].MinPos.Y);
        Assert.AreEqual(0, frames[0].MinPos.Z);
        Assert.AreEqual(8, frames[0].Dimensions.X);
        Assert.AreEqual(8, frames[0].Dimensions.Y);
        Assert.AreEqual(8, frames[0].Dimensions.Z);
    }

    [TestMethod]
    public void TestConvertGlobalArrayToFrames_MultipleChunks()
    {
        // Create a selection that spans multiple chunks (32 is chunk size)
        int xDim = 64, yDim = 64, zDim = 64;
        var selectionData = new byte[xDim * yDim * zDim];
        
        // Select voxels in different chunks
        var index1 = Module.CalculateVoxelIndex(0, 0, 0, yDim, zDim);   // First chunk (0,0,0)
        var index2 = Module.CalculateVoxelIndex(33, 0, 0, yDim, zDim);  // Second chunk (32,0,0)
        var index3 = Module.CalculateVoxelIndex(0, 33, 0, yDim, zDim);  // Third chunk (0,32,0)
        
        selectionData[index1] = 1;
        selectionData[index2] = 1;
        selectionData[index3] = 1;

        var frames = Module.SelectionHelper.ConvertGlobalArrayToFrames(selectionData, xDim, yDim, zDim);

        Assert.AreEqual(3, frames.Length, "Should create 3 frames for 3 different chunks with data");
    }

    [TestMethod]
    public void TestConvertGlobalArrayToFrames_EmptyArray()
    {
        int xDim = 32, yDim = 32, zDim = 32;
        var selectionData = new byte[xDim * yDim * zDim];
        // All zeros

        var frames = Module.SelectionHelper.ConvertGlobalArrayToFrames(selectionData, xDim, yDim, zDim);

        Assert.AreEqual(0, frames.Length, "Should create no frames for empty selection");
    }

    [TestMethod]
    public void TestConvertFramesToGlobalArray_RoundTrip()
    {
        // Test that converting to frames and back preserves data
        int xDim = 64, yDim = 32, zDim = 32;
        var originalData = new byte[xDim * yDim * zDim];
        
        // Select some voxels across multiple chunks
        originalData[0] = 1;
        originalData[1000] = 1;
        originalData[50000] = 1;

        var frames = Module.SelectionHelper.ConvertGlobalArrayToFrames(originalData, xDim, yDim, zDim);
        var reconstructed = Module.SelectionHelper.ConvertFramesToGlobalArray(frames, xDim, yDim, zDim);

        Assert.AreEqual(originalData.Length, reconstructed.Length);
        for (int i = 0; i < originalData.Length; i++)
        {
            Assert.AreEqual(originalData[i], reconstructed[i], $"Mismatch at index {i}");
        }
    }

    [TestMethod]
    public void TestGetFrameContainingPosition_Found()
    {
        var frames = new Module.VoxelFrame[]
        {
            new Module.VoxelFrame(
                new Module.Vector3(0, 0, 0),
                new Module.Vector3(32, 32, 32),
                new byte[0]
            ),
            new Module.VoxelFrame(
                new Module.Vector3(32, 0, 0),
                new Module.Vector3(32, 32, 32),
                new byte[0]
            )
        };

        var frame = Module.SelectionHelper.GetFrameContainingPosition(frames, new Module.Vector3(5, 5, 5));
        Assert.IsNotNull(frame);
        Assert.AreEqual(0, frame.Value.MinPos.X);

        var frame2 = Module.SelectionHelper.GetFrameContainingPosition(frames, new Module.Vector3(35, 5, 5));
        Assert.IsNotNull(frame2);
        Assert.AreEqual(32, frame2.Value.MinPos.X);
    }

    [TestMethod]
    public void TestGetFrameContainingPosition_NotFound()
    {
        var frames = new Module.VoxelFrame[]
        {
            new Module.VoxelFrame(
                new Module.Vector3(0, 0, 0),
                new Module.Vector3(32, 32, 32),
                new byte[0]
            )
        };

        var frame = Module.SelectionHelper.GetFrameContainingPosition(frames, new Module.Vector3(100, 100, 100));
        Assert.IsNull(frame);
    }

    [TestMethod]
    public void TestUpdateSelectionFrame_AddNew()
    {
        var existingFrames = new Module.VoxelFrame[0];
        var chunkMinPos = new Module.Vector3(0, 0, 0);
        var chunkDimensions = new Module.Vector3(32, 32, 32);
        var selectionData = new byte[32 * 32 * 32];
        selectionData[0] = 1;

        var updated = Module.SelectionHelper.UpdateSelectionFrame(existingFrames, chunkMinPos, chunkDimensions, selectionData);

        Assert.AreEqual(1, updated.Length);
        Assert.AreEqual(0, updated[0].MinPos.X);
    }

    [TestMethod]
    public void TestUpdateSelectionFrame_ReplaceExisting()
    {
        var oldData = new byte[32 * 32 * 32];
        oldData[0] = 1;
        
        var existingFrames = new Module.VoxelFrame[]
        {
            new Module.VoxelFrame(
                new Module.Vector3(0, 0, 0),
                new Module.Vector3(32, 32, 32),
                VoxelCompression.Compress(oldData)
            )
        };

        var chunkMinPos = new Module.Vector3(0, 0, 0);
        var chunkDimensions = new Module.Vector3(32, 32, 32);
        var newData = new byte[32 * 32 * 32];
        newData[100] = 1; // Different data

        var updated = Module.SelectionHelper.UpdateSelectionFrame(existingFrames, chunkMinPos, chunkDimensions, newData);

        Assert.AreEqual(1, updated.Length, "Should still have 1 frame");
        
        // Verify the data was updated by decompressing and checking
        var decompressed = VoxelCompression.Decompress(updated[0].VoxelData);
        Assert.AreEqual(0, decompressed[0], "Old data should be gone");
        Assert.AreEqual(1, decompressed[100], "New data should be present");
    }

    [TestMethod]
    public void TestUpdateSelectionFrame_RemoveEmptyFrame()
    {
        var oldData = new byte[32 * 32 * 32];
        oldData[0] = 1;
        
        var existingFrames = new Module.VoxelFrame[]
        {
            new Module.VoxelFrame(
                new Module.Vector3(0, 0, 0),
                new Module.Vector3(32, 32, 32),
                VoxelCompression.Compress(oldData)
            )
        };

        var chunkMinPos = new Module.Vector3(0, 0, 0);
        var chunkDimensions = new Module.Vector3(32, 32, 32);
        var emptyData = new byte[32 * 32 * 32]; // All zeros

        var updated = Module.SelectionHelper.UpdateSelectionFrame(existingFrames, chunkMinPos, chunkDimensions, emptyData);

        Assert.AreEqual(0, updated.Length, "Empty frame should be removed");
    }
}
