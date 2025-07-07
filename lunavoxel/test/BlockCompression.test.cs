using System.Collections.Generic;
using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using static Module;

namespace Test
{
    [TestClass]
    public class CompressTests
    {
        private static readonly BlockType BlueBlock = new(MeshType.Block, "blue");
        private static readonly BlockType RedBlock = new(MeshType.RoundBlock, "red");

        [TestMethod]
        public void Compress_SingleSolidVolume_ReturnsOneRun()
        {
            // ARRANGE: A 2x2x2 volume completely filled with blue blocks.
            var blocks = new BlockType?[2, 2, 2];
            for (int x = 0; x < 2; x++)
                for (int y = 0; y < 2; y++)
                    for (int z = 0; z < 2; z++)
                    {
                        blocks[x, y, z] = BlueBlock;
                    }

            // ACT
            var runs = BlockCompression.Compress(blocks);

            // ASSERT
            Assert.AreEqual(1, runs.Count, "Should find exactly one run for a solid volume.");

            var run = runs[0];
            Assert.AreEqual(new Vector3(0, 0, 0), run.TopLeft);
            Assert.AreEqual(new Vector3(1, 1, 1), run.BottomRight);
            Assert.AreEqual(BlueBlock.Type, run.Type);
            Assert.AreEqual(BlueBlock.Color, run.Color);
        }

        [TestMethod]
        public void Compress_TwoSeparateBlocks_ReturnsTwoRuns()
        {
            // ARRANGE: Two different blocks at opposite corners.
            var blocks = new BlockType?[2, 2, 2];
            blocks[0, 0, 0] = BlueBlock;
            blocks[1, 1, 1] = RedBlock;

            // ACT
            var runs = BlockCompression.Compress(blocks);

            // ASSERT
            Assert.AreEqual(2, runs.Count, "Should find two separate runs.");

            // Check that both expected runs exist (order isn't guaranteed)
            bool foundBlue = runs.Any(r => r.TopLeft == new Vector3(0, 0, 0) && r.BottomRight == new Vector3(0, 0, 0) && r.Type == BlueBlock.Type);
            bool foundRed = runs.Any(r => r.TopLeft == new Vector3(1, 1, 1) && r.BottomRight == new Vector3(1, 1, 1) && r.Type == RedBlock.Type);

            Assert.IsTrue(foundBlue, "The blue block run was not found.");
            Assert.IsTrue(foundRed, "The red block run was not found.");
        }

        [TestMethod]
        public void Compress_LShape_ReturnsTwoRunsDueToGreedyExpansion()
        {
            // ARRANGE: An "L" shape of blue blocks.
            // Because the algorithm expands X then Y, it should create a long horizontal
            // run and a shorter vertical run.
            //  B B B
            //  B
            //  B
            var blocks = new BlockType?[3, 3, 1];
            blocks[0, 0, 0] = BlueBlock; // Start of the horizontal bar
            blocks[1, 0, 0] = BlueBlock;
            blocks[2, 0, 0] = BlueBlock;
            blocks[0, 1, 0] = BlueBlock; // Start of the vertical bar
            blocks[0, 2, 0] = BlueBlock;

            // ACT
            var runs = BlockCompression.Compress(blocks);

            // ASSERT
            Assert.AreEqual(2, runs.Count, "The L-shape should be broken into two runs.");

            // The first run found (starting at 0,0,0) should be the horizontal bar
            var expectedHorizontalRun = new BlockRun(BlueBlock.Type, new Vector3(0, 0, 0), new Vector3(2, 0, 0), BlueBlock.Color);
            // The remaining blocks form the vertical run
            var expectedVerticalRun = new BlockRun(BlueBlock.Type, new Vector3(0, 1, 0), new Vector3(0, 2, 0), BlueBlock.Color);

            Assert.IsTrue(runs.Contains(expectedHorizontalRun), "The horizontal part of the L-shape was not found correctly.");
            Assert.IsTrue(runs.Contains(expectedVerticalRun), "The vertical part of the L-shape was not found correctly.");
        }

        [TestMethod]
        public void Compress_WithNullsInVolume_CorrectlyIgnoresNulls()
        {
            // ARRANGE: A 2x1x1 run with a null in the middle.
            // B [null] B
            var blocks = new BlockType?[3, 1, 1];
            blocks[0, 0, 0] = BlueBlock;
            blocks[2, 0, 0] = BlueBlock;

            // ACT
            var runs = BlockCompression.Compress(blocks);

            // ASSERT
            Assert.AreEqual(2, runs.Count, "Should find two runs separated by the null.");

            bool foundFirst = runs.Any(r => r.TopLeft == new Vector3(0, 0, 0) && r.BottomRight == new Vector3(0, 0, 0));
            bool foundSecond = runs.Any(r => r.TopLeft == new Vector3(2, 0, 0) && r.BottomRight == new Vector3(2, 0, 0));

            Assert.IsTrue(foundFirst, "Did not find the run before the null.");
            Assert.IsTrue(foundSecond, "Did not find the run after the null.");
        }

        [TestMethod]
        public void Compress_VolumeConservation_TotalRunVolumeEqualsBlockCount()
        {
            // ARRANGE: A complex scene with multiple runs and nulls
            var blocks = new BlockType?[4, 4, 4];
            blocks[0, 0, 0] = BlueBlock; // 1x1x1 run
            blocks[0, 0, 1] = BlueBlock;

            blocks[1, 1, 1] = RedBlock; // 2x2x1 run
            blocks[2, 1, 1] = RedBlock;
            blocks[1, 2, 1] = RedBlock;
            blocks[2, 2, 1] = RedBlock;

            int expectedBlockCount = 6;

            // ACT
            var runs = BlockCompression.Compress(blocks);

            // ASSERT: Calculate the total volume from the runs
            int actualVolume = 0;
            foreach (var run in runs)
            {
                actualVolume += (run.BottomRight.X - run.TopLeft.X + 1) *
                                (run.BottomRight.Y - run.TopLeft.Y + 1) *
                                (run.BottomRight.Z - run.TopLeft.Z + 1);
            }

            Assert.AreEqual(expectedBlockCount, actualVolume, "The total volume of runs should equal the number of non-null blocks.");
        }
    }
}