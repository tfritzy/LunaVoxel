using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Collections.Generic;

[TestClass]
public class MagicSelectTests
{
    [TestMethod]
    public void TestCalculateWorldIndex_SimplePosition()
    {
        int yDim = 10, zDim = 10;
        var position = new Module.Vector3(0, 0, 0);
        
        var index = Module.CalculateWorldIndex(position, yDim, zDim);
        
        Assert.AreEqual(0, index, "Position (0,0,0) should map to index 0");
    }

    [TestMethod]
    public void TestCalculateWorldIndex_ZAxisIncrement()
    {
        int yDim = 10, zDim = 10;
        var position = new Module.Vector3(0, 0, 1);
        
        var index = Module.CalculateWorldIndex(position, yDim, zDim);
        
        Assert.AreEqual(1, index, "Position (0,0,1) should map to index 1");
    }

    [TestMethod]
    public void TestCalculateWorldIndex_YAxisIncrement()
    {
        int yDim = 10, zDim = 10;
        var position = new Module.Vector3(0, 1, 0);
        
        var index = Module.CalculateWorldIndex(position, yDim, zDim);
        
        Assert.AreEqual(10, index, "Position (0,1,0) should map to index 10");
    }

    [TestMethod]
    public void TestCalculateWorldIndex_XAxisIncrement()
    {
        int yDim = 10, zDim = 10;
        var position = new Module.Vector3(1, 0, 0);
        
        var index = Module.CalculateWorldIndex(position, yDim, zDim);
        
        Assert.AreEqual(100, index, "Position (1,0,0) should map to index 100");
    }

    [TestMethod]
    public void TestCalculateWorldIndex_ComplexPosition()
    {
        int yDim = 5, zDim = 4;
        var position = new Module.Vector3(2, 3, 1);
        
        var index = Module.CalculateWorldIndex(position, yDim, zDim);
        
        Assert.AreEqual(2 * 5 * 4 + 3 * 4 + 1, index, "Position (2,3,1) should map correctly");
    }
}
