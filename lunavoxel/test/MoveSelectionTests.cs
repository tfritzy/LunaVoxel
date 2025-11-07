using Microsoft.VisualStudio.TestTools.UnitTesting;

[TestClass]
public class MoveSelectionTests
{
    [TestMethod]
    public void TestSelectionBounds_SimpleMove()
    {
        var minPos = new Module.Vector3(5, 10, 15);
        var maxPos = new Module.Vector3(10, 15, 20);
        var offset = new Module.Vector3(1, 0, 0);

        var newMinPos = new Module.Vector3(
            minPos.X + offset.X,
            minPos.Y + offset.Y,
            minPos.Z + offset.Z
        );
        var newMaxPos = new Module.Vector3(
            maxPos.X + offset.X,
            maxPos.Y + offset.Y,
            maxPos.Z + offset.Z
        );

        Assert.AreEqual(6, newMinPos.X);
        Assert.AreEqual(10, newMinPos.Y);
        Assert.AreEqual(15, newMinPos.Z);
        Assert.AreEqual(11, newMaxPos.X);
        Assert.AreEqual(15, newMaxPos.Y);
        Assert.AreEqual(20, newMaxPos.Z);
    }

    [TestMethod]
    public void TestSelectionBounds_NegativeMove()
    {
        var minPos = new Module.Vector3(5, 10, 15);
        var maxPos = new Module.Vector3(10, 15, 20);
        var offset = new Module.Vector3(-1, -2, -3);

        var newMinPos = new Module.Vector3(
            minPos.X + offset.X,
            minPos.Y + offset.Y,
            minPos.Z + offset.Z
        );
        var newMaxPos = new Module.Vector3(
            maxPos.X + offset.X,
            maxPos.Y + offset.Y,
            maxPos.Z + offset.Z
        );

        Assert.AreEqual(4, newMinPos.X);
        Assert.AreEqual(8, newMinPos.Y);
        Assert.AreEqual(12, newMinPos.Z);
        Assert.AreEqual(9, newMaxPos.X);
        Assert.AreEqual(13, newMaxPos.Y);
        Assert.AreEqual(17, newMaxPos.Z);
    }

    [TestMethod]
    public void TestSelectionBounds_MultiAxisMove()
    {
        var minPos = new Module.Vector3(0, 0, 0);
        var maxPos = new Module.Vector3(5, 5, 5);
        var offset = new Module.Vector3(10, 20, 30);

        var newMinPos = new Module.Vector3(
            minPos.X + offset.X,
            minPos.Y + offset.Y,
            minPos.Z + offset.Z
        );
        var newMaxPos = new Module.Vector3(
            maxPos.X + offset.X,
            maxPos.Y + offset.Y,
            maxPos.Z + offset.Z
        );

        Assert.AreEqual(10, newMinPos.X);
        Assert.AreEqual(20, newMinPos.Y);
        Assert.AreEqual(30, newMinPos.Z);
        Assert.AreEqual(15, newMaxPos.X);
        Assert.AreEqual(25, newMaxPos.Y);
        Assert.AreEqual(35, newMaxPos.Z);
    }

    [TestMethod]
    public void TestSelectionBounds_NoMove()
    {
        var minPos = new Module.Vector3(5, 10, 15);
        var maxPos = new Module.Vector3(10, 15, 20);
        var offset = new Module.Vector3(0, 0, 0);

        var newMinPos = new Module.Vector3(
            minPos.X + offset.X,
            minPos.Y + offset.Y,
            minPos.Z + offset.Z
        );
        var newMaxPos = new Module.Vector3(
            maxPos.X + offset.X,
            maxPos.Y + offset.Y,
            maxPos.Z + offset.Z
        );

        Assert.AreEqual(5, newMinPos.X);
        Assert.AreEqual(10, newMinPos.Y);
        Assert.AreEqual(15, newMinPos.Z);
        Assert.AreEqual(10, newMaxPos.X);
        Assert.AreEqual(15, newMaxPos.Y);
        Assert.AreEqual(20, newMaxPos.Z);
    }

    [TestMethod]
    public void TestSelectionDimensions_Preserved()
    {
        var minPos = new Module.Vector3(5, 10, 15);
        var maxPos = new Module.Vector3(10, 15, 20);
        var offset = new Module.Vector3(3, -5, 7);

        var originalWidth = maxPos.X - minPos.X;
        var originalHeight = maxPos.Y - minPos.Y;
        var originalDepth = maxPos.Z - minPos.Z;

        var newMinPos = new Module.Vector3(
            minPos.X + offset.X,
            minPos.Y + offset.Y,
            minPos.Z + offset.Z
        );
        var newMaxPos = new Module.Vector3(
            maxPos.X + offset.X,
            maxPos.Y + offset.Y,
            maxPos.Z + offset.Z
        );

        var newWidth = newMaxPos.X - newMinPos.X;
        var newHeight = newMaxPos.Y - newMinPos.Y;
        var newDepth = newMaxPos.Z - newMinPos.Z;

        Assert.AreEqual(originalWidth, newWidth);
        Assert.AreEqual(originalHeight, newHeight);
        Assert.AreEqual(originalDepth, newDepth);
    }
}
