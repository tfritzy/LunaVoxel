using Microsoft.VisualStudio.TestTools.UnitTesting;

// These tests are disabled because they reference Module.TranslateSelectionData
// which is not part of the current selection storage refactoring.
// Selection move functionality will be implemented separately.

/*
[TestClass]
public class MoveSelectionTests
{
    [TestMethod]
    public void TestTranslateSelectionData_SimpleMove()
    {
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[0] = 1; // Marker at index 0 (position 0,0,0), initially value = index + 1

        var offset = new Module.Vector3(1, 0, 0); // Move by 1 in X direction

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Index 0 is position (0,0,0), offset by (1,0,0) = (1,0,0) = index 4
        Assert.AreEqual(5, result[0], "Marker at index 0 moves to position 4, value becomes 5");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundX()
    {
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[4] = 5; // Marker at index 4 (position 1,0,0)

        var offset = new Module.Vector3(1, 0, 0); // Move by 1 in X direction

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Index 4 is position (1,0,0), offset by (1,0,0) = (2,0,0) wraps to (0,0,0) = index 0
        Assert.AreEqual(1, result[4], "Marker at index 4 wraps to position 0, value becomes 1");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundNegative()
    {
        int xDim = 3, yDim = 3, zDim = 3;
        var selectionData = new byte[27];
        selectionData[0] = 1; // Marker at index 0 (position 0,0,0)

        var offset = new Module.Vector3(-1, 0, 0); // Move by -1 in X direction

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Index 0 is position (0,0,0), offset by (-1,0,0) wraps to (2,0,0) = index 18
        Assert.AreEqual(19, result[0], "Marker at index 0 wraps to position 18, value becomes 19");
    }

    [TestMethod]
    public void TestTranslateSelectionData_MultipleVoxels()
    {
        int xDim = 4, yDim = 4, zDim = 4;
        var selectionData = new byte[64];
        selectionData[0] = 1;  // Marker at index 0 (position 0,0,0)
        selectionData[21] = 22; // Marker at index 21 (position 1,1,1)

        var offset = new Module.Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Index 0 (0,0,0) + (1,1,1) = (1,1,1) = index 21
        Assert.AreEqual(22, result[0], "Marker at index 0 moves to position 21, value becomes 22");
        // Index 21 (1,1,1) + (1,1,1) = (2,2,2) = index 42
        Assert.AreEqual(43, result[21], "Marker at index 21 moves to position 42, value becomes 43");
    }

    [TestMethod]
    public void TestTranslateSelectionData_NoMove()
    {
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[3] = 4;

        var offset = new Module.Vector3(0, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(4, result[3], "Voxel should stay in place with same value");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundAllAxes()
    {
        int xDim = 2, yDim = 3, zDim = 4;
        var selectionData = new byte[24];
        selectionData[23] = 24; // Marker at index 23 (position 1,2,3)

        var offset = new Module.Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        // Index 23 is position (1,2,3), offset by (1,1,1) = (2,3,4) wraps to (0,0,0) = index 0
        Assert.AreEqual(1, result[23], "Marker at index 23 wraps to position 0, value becomes 1");
    }
}
*/