using Microsoft.VisualStudio.TestTools.UnitTesting;

[TestClass]
public class MoveSelectionTests
{
    [TestMethod]
    public void TestTranslateSelectionData_SimpleMove()
    {
        // Arrange: 2x2x2 grid with one voxel selected at (0,0,0)
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8]; // 2*2*2
        selectionData[0] = 1; // Voxel at (0,0,0) selected, value is 1 (1-indexed position 0)

        var offset = new Vector3(1, 0, 0); // Move right by 1

        // Act
        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Assert
        // Original position (0,0,0) -> index 0
        // New position (1,0,0) -> index 1*2*2 + 0*2 + 0 = 4
        Assert.AreEqual(0, result[0], "Original position should be empty");
        Assert.AreEqual(1, result[4], "New position should have the value");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundX()
    {
        // Arrange: 2x2x2 grid with voxel at (1,0,0)
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[4] = 5; // Voxel at (1,0,0) -> index 4

        var offset = new Vector3(1, 0, 0); // Move right by 1, should wrap to x=0

        // Act
        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Assert
        // Position (1,0,0) + (1,0,0) = (2,0,0) -> wraps to (0,0,0) -> index 0
        Assert.AreEqual(5, result[0], "Should wrap around to x=0");
        Assert.AreEqual(0, result[4], "Original position should be empty");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundNegative()
    {
        // Arrange: 3x3x3 grid with voxel at (0,0,0)
        int xDim = 3, yDim = 3, zDim = 3;
        var selectionData = new byte[27];
        selectionData[0] = 1; // Voxel at (0,0,0)

        var offset = new Vector3(-1, 0, 0); // Move left by 1, should wrap to x=2

        // Act
        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Assert
        // Position (0,0,0) + (-1,0,0) = (-1,0,0) -> wraps to (2,0,0) -> index 18
        Assert.AreEqual(1, result[18], "Should wrap around to x=2");
        Assert.AreEqual(0, result[0], "Original position should be empty");
    }

    [TestMethod]
    public void TestTranslateSelectionData_MultipleVoxels()
    {
        // Arrange: 4x4x4 grid with two voxels
        int xDim = 4, yDim = 4, zDim = 4;
        var selectionData = new byte[64];
        selectionData[0] = 1;  // Voxel at (0,0,0)
        selectionData[21] = 22; // Voxel at (1,1,1) -> 1*16 + 1*4 + 1 = 21

        var offset = new Vector3(1, 1, 1);

        // Act
        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Assert
        // (0,0,0) + (1,1,1) = (1,1,1) -> index 21
        // (1,1,1) + (1,1,1) = (2,2,2) -> index 2*16 + 2*4 + 2 = 42
        Assert.AreEqual(1, result[21], "First voxel should move to (1,1,1)");
        Assert.AreEqual(22, result[42], "Second voxel should move to (2,2,2)");
        Assert.AreEqual(0, result[0], "Original position of first voxel should be empty");
    }

    [TestMethod]
    public void TestTranslateSelectionData_NoMove()
    {
        // Arrange: 2x2x2 grid with one voxel
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[3] = 4;

        var offset = new Vector3(0, 0, 0); // No movement

        // Act
        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Assert
        Assert.AreEqual(4, result[3], "Voxel should stay in place");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundAllAxes()
    {
        // Arrange: 2x3x4 grid with voxel at (1,2,3)
        int xDim = 2, yDim = 3, zDim = 4;
        var selectionData = new byte[24]; // 2*3*4
        // (1,2,3) -> index = 1 * 12 + 2 * 4 + 3 = 23
        selectionData[23] = 24;

        var offset = new Vector3(1, 1, 1); // Should wrap all axes

        // Act
        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Assert
        // (1,2,3) + (1,1,1) = (2,3,4) -> wraps to (0,0,0) -> index 0
        Assert.AreEqual(24, result[0], "Should wrap around all axes");
        Assert.AreEqual(0, result[23], "Original position should be empty");
    }
}
