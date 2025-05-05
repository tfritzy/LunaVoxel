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
            Block[] blocks = new Block[] { new Block(BlockType.Empty, 10, false) };

            BlockCompression.SetBlock(blocks, BlockType.Block, 5, false);

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
            Block[] blocks = new Block[] { new Block(BlockType.Empty, 10, false) };

            BlockCompression.SetBlock(blocks, BlockType.Block, 0, false);

            Assert.AreEqual(2, blocks.Length);
            Assert.AreEqual(BlockType.Block, blocks[0].Type);
            Assert.AreEqual(1, blocks[0].Count);
            Assert.AreEqual(BlockType.Empty, blocks[1].Type);
            Assert.AreEqual(9, blocks[1].Count);
        }

        [TestMethod]
        public void SetBlock_AtEnd_ShouldAddBlock()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Empty, 10, false) };

            BlockCompression.SetBlock(blocks, BlockType.Block, 9, false);

            Assert.AreEqual(2, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(9, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(1, blocks[1].Count);
        }

        [TestMethod]
        public void SetBlock_SameTypeAsExisting_ShouldNotChange()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Block, 10, false) };

            BlockCompression.SetBlock(blocks, BlockType.Block, 5, false);

            Assert.AreEqual(1, blocks.Length);
            Assert.AreEqual(BlockType.Block, blocks[0].Type);
            Assert.AreEqual(10, blocks[0].Count);
        }

        [TestMethod]
        public void SetBlock_WithMerging_ShouldMergeAdjacentSameTypes()
        {
            Block[] blocks = new Block[] {
                new Block(BlockType.Empty, 5, false),
                new Block(BlockType.Block, 5, false),
                new Block(BlockType.Empty, 5, false)
            };

            BlockCompression.SetBlock(blocks, BlockType.Block, 4, false);

            Assert.AreEqual(2, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(4, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(6, blocks[1].Count);
        }

        [TestMethod]
        public void SetBlock_WithGhostFlag_ShouldConsiderGhostFlagForMerging()
        {
            Block[] blocks = new Block[] {
                new Block(BlockType.Block, 5, false),
                new Block(BlockType.Block, 5, true)
            };

            BlockCompression.SetBlock(blocks, BlockType.Block, 2, true);

            Assert.AreEqual(3, blocks.Length);
            Assert.AreEqual(BlockType.Block, blocks[0].Type);
            Assert.AreEqual(2, blocks[0].Count);
            Assert.AreEqual(false, blocks[0].Ghost);

            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(1, blocks[1].Count);
            Assert.AreEqual(true, blocks[1].Ghost);

            Assert.AreEqual(BlockType.Block, blocks[2].Type);
            Assert.AreEqual(7, blocks[2].Count);
            Assert.AreEqual(false, blocks[2].Ghost);
        }

        [TestMethod]
        public void SetBlock_BeyondBlocksLength_ShouldDoNothing()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Empty, 10, false) };
            int originalLength = blocks.Length;

            BlockCompression.SetBlock(blocks, BlockType.Block, 20, false);

            Assert.AreEqual(originalLength, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(10, blocks[0].Count);
        }

        [TestMethod]
        public void SetBlock_MultipleBlocksWithMerge_ShouldHandleComplexCase()
        {
            Block[] blocks = new Block[] {
                new Block(BlockType.Empty, 3, false),
                new Block(BlockType.Block, 2, false),
                new Block(BlockType.LongBlock, 2, false),
                new Block(BlockType.Empty, 3, false)
            };

            BlockCompression.SetBlock(blocks, BlockType.LongBlock, 4, false);

            Assert.AreEqual(3, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(3, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(1, blocks[1].Count);
            Assert.AreEqual(BlockType.LongBlock, blocks[2].Type);
            Assert.AreEqual(6, blocks[2].Count);
        }

        [TestMethod]
        public void SetBlock_EmptyToNonEmptyAndBack_ShouldCompressCorrectly()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Empty, 10, false) };

            BlockCompression.SetBlock(blocks, BlockType.Block, 5, false);
            BlockCompression.SetBlock(blocks, BlockType.Empty, 5, false);

            Assert.AreEqual(1, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(10, blocks[0].Count);
        }
    }
}