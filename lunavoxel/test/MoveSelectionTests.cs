using Microsoft.VisualStudio.TestTools.UnitTesting;

[TestClass]
public class MoveSelectionTests
{
    [TestMethod]
    public void TestTranslateSelectionData_SimpleMove()
    {
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[0] = 1;

        var offset = new Vector3(1, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(0, result[0], "Original position should be empty");
        Assert.AreEqual(5, result[4], "New position (1,0,0) -> index 4 should have value 5");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundX()
    {
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[4] = 5;

        var offset = new Vector3(1, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(1, result[0], "Should wrap around to (0,0,0) with value 1");
        Assert.AreEqual(0, result[4], "Original position should be empty");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundNegative()
    {
        int xDim = 3, yDim = 3, zDim = 3;
        var selectionData = new byte[27];
        selectionData[0] = 1;

        var offset = new Vector3(-1, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(19, result[18], "Should wrap around to (2,0,0) -> index 18 with value 19");
        Assert.AreEqual(0, result[0], "Original position should be empty");
    }

    [TestMethod]
    public void TestTranslateSelectionData_MultipleVoxels()
    {
        int xDim = 4, yDim = 4, zDim = 4;
        var selectionData = new byte[64];
        selectionData[0] = 1;
        selectionData[21] = 22;

        var offset = new Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(22, result[21], "First voxel moves to (1,1,1) -> index 21 with value 22");
        Assert.AreEqual(43, result[42], "Second voxel moves to (2,2,2) -> index 42 with value 43");
        Assert.AreEqual(0, result[0], "Original position of first voxel should be empty");
    }

    [TestMethod]
    public void TestTranslateSelectionData_NoMove()
    {
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[3] = 4;

        var offset = new Vector3(0, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(4, result[3], "Voxel should stay in place with same value");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundAllAxes()
    {
        int xDim = 2, yDim = 3, zDim = 4;
        var selectionData = new byte[24];
        selectionData[23] = 24;

        var offset = new Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(1, result[0], "Should wrap around to (0,0,0) -> index 0 with value 1");
        Assert.AreEqual(0, result[23], "Original position should be empty");
    }
}
