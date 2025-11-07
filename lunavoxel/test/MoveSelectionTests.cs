using Microsoft.VisualStudio.TestTools.UnitTesting;

[TestClass]
public class MoveSelectionTests
{
    [TestMethod]
    public void TestTranslateSelectionData_SimpleMove()
    {
        int layerXDim = 2, layerYDim = 2, layerZDim = 2;
        var minPos = new Module.Vector3(0, 0, 0);
        var dimensions = new Module.Vector3(2, 2, 2);
        var selectionData = new byte[8];
        selectionData[0] = 1; // Marker at index 0 (position 0,0,0), initially value = index + 1

        var offset = new Module.Vector3(1, 0, 0); // Move by 1 in X direction

        var result = Module.TranslateSelectionData(selectionData, offset, minPos, dimensions, layerXDim, layerYDim, layerZDim);

        // Index 0 is position (0,0,0), offset by (1,0,0) = (1,0,0) = index 4
        Assert.AreEqual(5, result[0], "Marker at index 0 moves to position 4, value becomes 5");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundX()
    {
        int layerXDim = 2, layerYDim = 2, layerZDim = 2;
        var minPos = new Module.Vector3(0, 0, 0);
        var dimensions = new Module.Vector3(2, 2, 2);
        var selectionData = new byte[8];
        selectionData[4] = 5; // Marker at index 4 (position 1,0,0)

        var offset = new Module.Vector3(1, 0, 0); // Move by 1 in X direction

        var result = Module.TranslateSelectionData(selectionData, offset, minPos, dimensions, layerXDim, layerYDim, layerZDim);

        // Index 4 is position (1,0,0), offset by (1,0,0) = (2,0,0) wraps to (0,0,0) = index 0
        Assert.AreEqual(1, result[4], "Marker at index 4 wraps to position 0, value becomes 1");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundNegative()
    {
        int layerXDim = 3, layerYDim = 3, layerZDim = 3;
        var minPos = new Module.Vector3(0, 0, 0);
        var dimensions = new Module.Vector3(3, 3, 3);
        var selectionData = new byte[27];
        selectionData[0] = 1; // Marker at index 0 (position 0,0,0)

        var offset = new Module.Vector3(-1, 0, 0); // Move by -1 in X direction

        var result = Module.TranslateSelectionData(selectionData, offset, minPos, dimensions, layerXDim, layerYDim, layerZDim);

        // Index 0 is position (0,0,0), offset by (-1,0,0) wraps to (2,0,0) = index 18
        Assert.AreEqual(19, result[0], "Marker at index 0 wraps to position 18, value becomes 19");
    }

    [TestMethod]
    public void TestTranslateSelectionData_MultipleVoxels()
    {
        int layerXDim = 4, layerYDim = 4, layerZDim = 4;
        var minPos = new Module.Vector3(0, 0, 0);
        var dimensions = new Module.Vector3(4, 4, 4);
        var selectionData = new byte[64];
        selectionData[0] = 1;  // Marker at index 0 (position 0,0,0)
        selectionData[21] = 22; // Marker at index 21 (position 1,1,1)

        var offset = new Module.Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, minPos, dimensions, layerXDim, layerYDim, layerZDim);

        // Index 0 (0,0,0) + (1,1,1) = (1,1,1) = index 21
        Assert.AreEqual(22, result[0], "Marker at index 0 moves to position 21, value becomes 22");
        // Index 21 (1,1,1) + (1,1,1) = (2,2,2) = index 42
        Assert.AreEqual(43, result[21], "Marker at index 21 moves to position 42, value becomes 43");
    }

    [TestMethod]
    public void TestTranslateSelectionData_NoMove()
    {
        int layerXDim = 2, layerYDim = 2, layerZDim = 2;
        var minPos = new Module.Vector3(0, 0, 0);
        var dimensions = new Module.Vector3(2, 2, 2);
        var selectionData = new byte[8];
        selectionData[3] = 4;

        var offset = new Module.Vector3(0, 0, 0);

        var result = Module.TranslateSelectionData(selectionData, offset, minPos, dimensions, layerXDim, layerYDim, layerZDim);

        Assert.AreEqual(4, result[3], "Voxel should stay in place with same value");
    }

    [TestMethod]
    public void TestTranslateSelectionData_WrapAroundAllAxes()
    {
        int layerXDim = 2, layerYDim = 3, layerZDim = 4;
        var minPos = new Module.Vector3(0, 0, 0);
        var dimensions = new Module.Vector3(2, 3, 4);
        var selectionData = new byte[24];
        selectionData[23] = 24; // Marker at index 23 (position 1,2,3)

        var offset = new Module.Vector3(1, 1, 1);

        var result = Module.TranslateSelectionData(selectionData, offset, minPos, dimensions, layerXDim, layerYDim, layerZDim);

        // Index 23 is position (1,2,3), offset by (1,1,1) = (2,3,4) wraps to (0,0,0) = index 0
        Assert.AreEqual(1, result[23], "Marker at index 23 wraps to position 0, value becomes 1");
    }
}
