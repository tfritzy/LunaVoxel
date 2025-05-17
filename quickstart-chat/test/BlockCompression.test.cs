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

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 5, false);

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

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 0, false);

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

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 9, false);

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

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 5, false);

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

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 4, false);

            Assert.AreEqual(3, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(4, blocks[0].Count);
            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(6, blocks[1].Count);
            Assert.AreEqual(BlockType.Empty, blocks[2].Type);
            Assert.AreEqual(5, blocks[2].Count);
        }

        [TestMethod]
        public void SetBlock_WithGhostFlag_ShouldConsiderGhostFlagForMerging()
        {
            Block[] blocks = new Block[] {
                new Block(BlockType.Block, 5, false),
                new Block(BlockType.Block, 5, true)
            };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 2, true);

            Assert.AreEqual(4, blocks.Length);
            Assert.AreEqual(BlockType.Block, blocks[0].Type);
            Assert.AreEqual(2, blocks[0].Count);
            Assert.AreEqual(false, blocks[0].Ghost);

            Assert.AreEqual(BlockType.Block, blocks[1].Type);
            Assert.AreEqual(1, blocks[1].Count);
            Assert.AreEqual(true, blocks[1].Ghost);

            Assert.AreEqual(BlockType.Block, blocks[2].Type);
            Assert.AreEqual(2, blocks[2].Count);
            Assert.AreEqual(false, blocks[2].Ghost);

            Assert.AreEqual(BlockType.Block, blocks[3].Type);
            Assert.AreEqual(5, blocks[3].Count);
            Assert.AreEqual(true, blocks[3].Ghost);
        }
        [TestMethod]
        public void SetBlock_BeyondBlocksLength_ShouldDoNothing()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Empty, 10, false) };
            int originalLength = blocks.Length;

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 20, false);

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
                new Block(BlockType.RoundBlock, 2, false),
                new Block(BlockType.Empty, 3, false)
            };

            BlockCompression.SetBlock(ref blocks, BlockType.RoundBlock, 4, false);

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
            Block[] blocks = new Block[] { new Block(BlockType.Empty, 10, false) };

            BlockCompression.SetBlock(ref blocks, BlockType.Block, 5, false);
            BlockCompression.SetBlock(ref blocks, BlockType.Empty, 5, false);

            Assert.AreEqual(1, blocks.Length);
            Assert.AreEqual(BlockType.Empty, blocks[0].Type);
            Assert.AreEqual(10, blocks[0].Count);
        }

        [TestMethod]
        public void GetBlock_InSingleBlockChunk_ShouldReturnCorrectTypeAndGhost()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Block, 10, false) };

            var blockInfo = BlockCompression.GetBlock(blocks, 5);

            Assert.AreEqual(BlockType.Block, blockInfo.Type);
            Assert.AreEqual(false, blockInfo.Ghost);
        }

        [TestMethod]
        public void GetBlock_AtBeginningOfSingleBlockChunk_ShouldReturnCorrectTypeAndGhost()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Block, 10, true) };

            var blockInfo = BlockCompression.GetBlock(blocks, 0);

            Assert.AreEqual(BlockType.Block, blockInfo.Type);
            Assert.AreEqual(true, blockInfo.Ghost);
        }

        [TestMethod]
        public void GetBlock_AtEndOfSingleBlockChunk_ShouldReturnCorrectTypeAndGhost()
        {
            Block[] blocks = new Block[] { new Block(BlockType.RoundBlock, 10, false) };

            var blockInfo = BlockCompression.GetBlock(blocks, 9);

            Assert.AreEqual(BlockType.RoundBlock, blockInfo.Type);
            Assert.AreEqual(false, blockInfo.Ghost);
        }

        [TestMethod]
        public void GetBlock_BeyondEndOfSingleBlockChunk_ShouldReturnDefault()
        {
            Block[] blocks = new Block[] { new Block(BlockType.Block, 10, false) };

            var blockInfo = BlockCompression.GetBlock(blocks, 10);

            Assert.AreEqual(default(BlockType), blockInfo.Type);
            Assert.AreEqual(default(bool), blockInfo.Ghost);
        }

        [TestMethod]
        public void GetBlock_FromEmptyArray_ShouldReturnDefault()
        {
            Block[] blocks = new Block[0];

            var blockInfo = BlockCompression.GetBlock(blocks, 5);

            Assert.AreEqual(default(BlockType), blockInfo.Type);
            Assert.AreEqual(default(bool), blockInfo.Ghost);
        }

        [TestMethod]
        public void GetBlock_FromMultipleBlocks_ShouldReturnCorrectTypeAndGhost()
        {
            Block[] blocks = new Block[] {
                new Block(BlockType.Empty, 5, false),      // Indices 0-4
                new Block(BlockType.Block, 3, true),       // Indices 5-7
                new Block(BlockType.RoundBlock, 2, false)   // Indices 8-9
            };

            var blockInfo0 = BlockCompression.GetBlock(blocks, 0);
            Assert.AreEqual(BlockType.Empty, blockInfo0.Type);
            Assert.AreEqual(false, blockInfo0.Ghost);

            var blockInfo4 = BlockCompression.GetBlock(blocks, 4);
            Assert.AreEqual(BlockType.Empty, blockInfo4.Type);
            Assert.AreEqual(false, blockInfo4.Ghost);

            var blockInfo5 = BlockCompression.GetBlock(blocks, 5);
            Assert.AreEqual(BlockType.Block, blockInfo5.Type);
            Assert.AreEqual(true, blockInfo5.Ghost);

            var blockInfo7 = BlockCompression.GetBlock(blocks, 7);
            Assert.AreEqual(BlockType.Block, blockInfo7.Type);
            Assert.AreEqual(true, blockInfo7.Ghost);

            var blockInfo8 = BlockCompression.GetBlock(blocks, 8);
            Assert.AreEqual(BlockType.RoundBlock, blockInfo8.Type);
            Assert.AreEqual(false, blockInfo8.Ghost);

            var blockInfo9 = BlockCompression.GetBlock(blocks, 9);
            Assert.AreEqual(BlockType.RoundBlock, blockInfo9.Type);
            Assert.AreEqual(false, blockInfo9.Ghost);
        }

        [TestMethod]
        public void GetBlock_BeyondEndOfMultipleBlocks_ShouldReturnDefault()
        {
            Block[] blocks = new Block[] {
                new Block(BlockType.Empty, 5, false),      // Indices 0-4
                new Block(BlockType.Block, 3, true),       // Indices 5-7
                new Block(BlockType.RoundBlock, 2, false)   // Indices 8-9
            };

            var blockInfo = BlockCompression.GetBlock(blocks, 10);
            Assert.AreEqual(default(BlockType), blockInfo.Type);
            Assert.AreEqual(default(bool), blockInfo.Ghost);

            var blockInfoNegative = BlockCompression.GetBlock(blocks, -1);
            Assert.AreEqual(default(BlockType), blockInfoNegative.Type);
            Assert.AreEqual(default(bool), blockInfoNegative.Ghost);
        }
    }
}