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

        Assert.AreEqual(5, result[0], "Marker at index 0 should now indicate voxel is at position 4 (value 5)");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundX()
    {
        int xDim = 2, yDim = 2, zDim = 2;
        var selectionData = new byte[8];
        selectionData[0] = 5;

        var offset = new Vector3(1, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(1, result[0], "Voxel at position 4 moves to position 0 (wraps), value becomes 1");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundNegative()
    {
        int xDim = 3, yDim = 3, zDim = 3;
        var selectionData = new byte[27];
        selectionData[0] = 1;

        var offset = new Vector3(-1, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(19, result[0], "Voxel at position 0 moves to position 18 (wraps), value becomes 19");
    }

    [TestMethod]
    public void TestTranslateSelectionData_MultipleVoxels()
    {
        int xDim = 4, yDim = 4, zDim = 4;
        var selectionData = new byte[64];
        selectionData[0] = 1;
        selectionData[1] = 22;

        var offset = new Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(22, result[0], "First voxel moves from position 0 to position 21, value becomes 22");
        Assert.AreEqual(43, result[1], "Second voxel moves from position 21 to position 42, value becomes 43");
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
        selectionData[0] = 24;

        var offset = new Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, xDim, yDim, zDim);

        Assert.AreEqual(1, result[0], "Voxel at position 23 wraps to position 0, value becomes 1");
    }
}
