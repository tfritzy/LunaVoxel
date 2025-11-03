using Microsoft.VisualStudio.TestTools.UnitTesting;

[TestClass]
public class BlockModificationHelperTests
{
    [TestMethod]
    public void ApplyDiffData_AttachMode_SetsNonZeroValues()
    {
        // Arrange
        var voxels = new byte[] { 0, 0, 0, 0 };
        var diffData = new byte[] { 1, 0, 3, 0 };
        var mode = Module.BlockModificationMode.Attach;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(1, voxels[0], "Should set voxel to diffData value");
        Assert.AreEqual(0, voxels[1], "Should not change voxel when diffData is 0");
        Assert.AreEqual(3, voxels[2], "Should set voxel to diffData value");
        Assert.AreEqual(0, voxels[3], "Should not change voxel when diffData is 0");
    }

    [TestMethod]
    public void ApplyDiffData_EraseMode_SetsToZeroWhenDiffDataIsNonZero()
    {
        // Arrange
        var voxels = new byte[] { 5, 7, 0, 9 };
        var diffData = new byte[] { 1, 0, 1, 1 };
        var mode = Module.BlockModificationMode.Erase;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(0, voxels[0], "Should erase voxel (set to 0) when diffData is non-zero");
        Assert.AreEqual(7, voxels[1], "Should not change voxel when diffData is 0");
        Assert.AreEqual(0, voxels[2], "Should erase voxel (set to 0) when diffData is non-zero");
        Assert.AreEqual(0, voxels[3], "Should erase voxel (set to 0) when diffData is non-zero");
    }

    [TestMethod]
    public void ApplyDiffData_EraseMode_PreservesZeroInDiffData()
    {
        // Arrange
        var voxels = new byte[] { 1, 2, 3, 4 };
        var diffData = new byte[] { 0, 0, 0, 0 };
        var mode = Module.BlockModificationMode.Erase;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(1, voxels[0], "Should preserve voxel when diffData is 0");
        Assert.AreEqual(2, voxels[1], "Should preserve voxel when diffData is 0");
        Assert.AreEqual(3, voxels[2], "Should preserve voxel when diffData is 0");
        Assert.AreEqual(4, voxels[3], "Should preserve voxel when diffData is 0");
    }

    [TestMethod]
    public void ApplyDiffData_PaintMode_SetsNonZeroValues()
    {
        // Arrange
        var voxels = new byte[] { 1, 2, 3, 4 };
        var diffData = new byte[] { 5, 0, 7, 0 };
        var mode = Module.BlockModificationMode.Paint;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(5, voxels[0], "Should paint voxel with diffData value");
        Assert.AreEqual(2, voxels[1], "Should not change voxel when diffData is 0");
        Assert.AreEqual(7, voxels[2], "Should paint voxel with diffData value");
        Assert.AreEqual(4, voxels[3], "Should not change voxel when diffData is 0");
    }

    [TestMethod]
    public void ApplyDiffData_EraseMode_DifferentNonZeroValuesStillEraseToZero()
    {
        // Arrange
        var voxels = new byte[] { 10, 20, 30, 40 };
        var diffData = new byte[] { 1, 5, 255, 128 }; // Different non-zero values
        var mode = Module.BlockModificationMode.Erase;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(0, voxels[0], "Should erase to 0 regardless of diffData value");
        Assert.AreEqual(0, voxels[1], "Should erase to 0 regardless of diffData value");
        Assert.AreEqual(0, voxels[2], "Should erase to 0 regardless of diffData value");
        Assert.AreEqual(0, voxels[3], "Should erase to 0 regardless of diffData value");
    }

    [TestMethod]
    public void ApplyDiffData_AttachMode_OverwritesExistingVoxels()
    {
        // Arrange
        var voxels = new byte[] { 1, 2, 3, 4 };
        var diffData = new byte[] { 10, 20, 0, 40 };
        var mode = Module.BlockModificationMode.Attach;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(10, voxels[0], "Should overwrite existing voxel");
        Assert.AreEqual(20, voxels[1], "Should overwrite existing voxel");
        Assert.AreEqual(3, voxels[2], "Should not change when diffData is 0");
        Assert.AreEqual(40, voxels[3], "Should overwrite existing voxel");
    }

    [TestMethod]
    public void ApplyDiffData_EmptyArrays_NoChanges()
    {
        // Arrange
        var voxels = new byte[] { };
        var diffData = new byte[] { };
        var mode = Module.BlockModificationMode.Attach;

        // Act - should not throw
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(0, voxels.Length, "Empty array should remain empty");
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void ApplyDiffData_NullVoxels_ThrowsArgumentNullException()
    {
        // Arrange
        byte[] voxels = null!;
        var diffData = new byte[] { 1, 2, 3 };
        var mode = Module.BlockModificationMode.Attach;

        // Act - should throw
        Module.ApplyDiffData(voxels, diffData, mode);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void ApplyDiffData_NullDiffData_ThrowsArgumentNullException()
    {
        // Arrange
        var voxels = new byte[] { 1, 2, 3 };
        byte[] diffData = null!;
        var mode = Module.BlockModificationMode.Attach;

        // Act - should throw
        Module.ApplyDiffData(voxels, diffData, mode);
    }

    [TestMethod]
    public void ApplyDiffData_DiffDataLargerThanVoxels_OnlyModifiesVoxelsLength()
    {
        // Arrange
        var voxels = new byte[] { 1, 2 };
        var diffData = new byte[] { 10, 20, 30, 40 }; // Larger than voxels
        var mode = Module.BlockModificationMode.Attach;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(10, voxels[0], "First voxel should be modified");
        Assert.AreEqual(20, voxels[1], "Second voxel should be modified");
        Assert.AreEqual(2, voxels.Length, "Voxels array length should not change");
    }

    [TestMethod]
    public void ApplyDiffData_DiffDataSmallerThanVoxels_OnlyModifiesDiffDataLength()
    {
        // Arrange
        var voxels = new byte[] { 1, 2, 3, 4 };
        var diffData = new byte[] { 10, 20 }; // Smaller than voxels
        var mode = Module.BlockModificationMode.Attach;

        // Act
        Module.ApplyDiffData(voxels, diffData, mode);

        // Assert
        Assert.AreEqual(10, voxels[0], "First voxel should be modified");
        Assert.AreEqual(20, voxels[1], "Second voxel should be modified");
        Assert.AreEqual(3, voxels[2], "Third voxel should be unchanged");
        Assert.AreEqual(4, voxels[3], "Fourth voxel should be unchanged");
    }
}
