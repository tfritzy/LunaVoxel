using Microsoft.VisualStudio.TestTools.UnitTesting;
using static Module;

namespace Test
{
    [TestClass]
    public class BlockCompressionTests
    {
        [TestMethod]
        public void SetBlock_InEmptyChunk_ShouldAddBlock()
        {
            BlockRun[] blocks = new BlockRun[] { new BlockRun(BlockType.Empty, 10) };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 5);

            Assert.AreEqual(3, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(5, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(1, blocks[1].Count);
            Assert.AreEqual(BlockType.Empty, blocks[2].Type);
            Assert.AreEqual(4, blocks[2].Count);
        }

        [TestMethod]
        public void SetBlock_AtBeginning_ShouldAddBlock()
        {
            BlockRun[] blocks = new BlockRun[] { new BlockRun(BlockType.Empty, 10) };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 0);

            Assert.AreEqual(2, blocks.Length);
            Assert.AreEqual(BlockType.Block, blocks[0].Type);
            Assert.AreEqual(1, blocks[0].Count);
            Assert.AreEqual(BlockType.Empty, blocks[1].Type);
            Assert.AreEqual(9, blocks[1].Count);
        }

        [TestMethod]
        public void SetBlock_AtEnd_ShouldAddBlock()
        {
            BlockRun[] blocks = new BlockRun[] { new BlockRun(BlockType.Empty, 10) };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 9);

            Assert.AreEqual(2, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(9, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(1, blocks[1].Count);
        }

        [TestMethod]
        public void SetBlock_SameTypeAsExisting_ShouldNotChange()
        {
            BlockRun[] blocks = new BlockRun[] { new BlockRun(BlockType.Block, 10) };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 5);

            Assert.AreEqual(1, blocks.Length);
            Assert.AreEqual(BlockType.Block, blocks[0].Type);
            Assert.AreEqual(10, blocks[0].Count);
        }

        [TestMethod]
        public void SetBlock_WithMerging_ShouldMergeAdjacentSameTypes()
        {
            BlockRun[] blocks = new BlockRun[] {
                new BlockRun(BlockType.Empty, 5),
                new BlockRun(BlockType.Block, 5),
                new BlockRun(BlockType.Empty, 5)
            };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 4);

            Assert.AreEqual(3, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(4, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(6, blocks[1].Count);
            Assert.AreEqual(BlockType.Empty, blocks[2].Type);
            Assert.AreEqual(5, blocks[2].Count);
        }

        [TestMethod]
        public void SetBlock_BeyondBlocksLength_ShouldDoNothing()
        {
            BlockRun[] blocks = new BlockRun[] { new BlockRun(BlockType.Empty, 10) };
            int originalLength = blocks.Length;

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 20);

            Assert.AreEqual(originalLength, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(10, blocks[0].Count);
        }

        [TestMethod]
        public void SetBlock_MultipleBlocksWithMerge_ShouldHandleComplexCase()
        {
            BlockRun[] blocks = new BlockRun[] {
                new BlockRun(BlockType.Empty, 3),
                new BlockRun(BlockType.Block, 2),
                new BlockRun(BlockType.RoundBlock, 2),
                new BlockRun(BlockType.Empty, 3)
            };

            BlockCompression.SetBlock(ref blocks, BlockType.RoundBlock, 4);

            Assert.AreEqual(4, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(3, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(1, blocks[1].Count);
            Assert.AreEqual(BlockType.RoundBlock, blocks[2].Type);
            Assert.AreEqual(3, blocks[2].Count);
            Assert.AreEqual(BlockType.Empty, blocks[3].Type);
            Assert.AreEqual(3, blocks[3].Count);
        }

        [TestMethod]
        public void SetBlock_EmptyToNonEmptyAndBack_ShouldCompressCorrectly()
        {
            BlockRun[] blocks = new BlockRun[] { new BlockRun(BlockType.Empty, 10) };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 5);
            BlockCompression.SetBlock(ref blocks, BlockType.Empty, 5);

            Assert.AreEqual(1, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(10, blocks[0].Count);
        }

        [TestMethod]
        public void GetBlock_BeyondEndOfSingleBlockChunk_ShouldReturnDefault()
        {
            BlockRun[] blocks = new BlockRun[] { new BlockRun(BlockType.Block, 10) };

            var blockInfo = BlockCompression.GetBlock(blocks, 10);

            Assert.AreEqual(default(BlockType), blockInfo.Type);
        }

        [TestMethod]
        public void GetBlock_FromEmptyArray_ShouldReturnDefault()
        {
            BlockRun[] blocks = new BlockRun[0];

            var blockInfo = BlockCompression.GetBlock(blocks, 5);

            Assert.AreEqual(default(BlockType), blockInfo.Type);
        }
    }
}