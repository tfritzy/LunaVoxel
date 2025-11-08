using System;
using System.Collections.Generic;
using System.Linq;

public static partial class Module
{
    /// <summary>
    /// Helper functions for working with chunk-based selection frames
    /// </summary>
    public static class SelectionHelper
    {
        /// <summary>
        /// Creates a VoxelFrame for a given chunk position with selection data
        /// </summary>
        public static VoxelFrame CreateSelectionFrame(Vector3 chunkMinPos, Vector3 chunkDimensions, byte[] selectionData)
        {
            return new VoxelFrame(chunkMinPos, chunkDimensions, VoxelCompression.Compress(selectionData));
        }

        /// <summary>
        /// Gets the VoxelFrame that contains the given world position, or null if none exists
        /// </summary>
        public static VoxelFrame? GetFrameContainingPosition(VoxelFrame[] frames, Vector3 position)
        {
            foreach (var frame in frames)
            {
                if (position.X >= frame.MinPos.X && position.X < frame.MinPos.X + frame.Dimensions.X &&
                    position.Y >= frame.MinPos.Y && position.Y < frame.MinPos.Y + frame.Dimensions.Y &&
                    position.Z >= frame.MinPos.Z && position.Z < frame.MinPos.Z + frame.Dimensions.Z)
                {
                    return frame;
                }
            }
            return null;
        }

        /// <summary>
        /// Checks if a position is selected in the given selection frames
        /// </summary>
        public static bool IsPositionSelected(VoxelFrame[] frames, Vector3 position)
        {
            var frame = GetFrameContainingPosition(frames, position);
            if (frame == null) return false;

            var localX = position.X - frame.Value.MinPos.X;
            var localY = position.Y - frame.Value.MinPos.Y;
            var localZ = position.Z - frame.Value.MinPos.Z;

            var decompressed = VoxelCompression.Decompress(frame.Value.VoxelData);
            var index = CalculateVoxelIndex(localX, localY, localZ, frame.Value.Dimensions.Y, frame.Value.Dimensions.Z);

            return index < decompressed.Length && decompressed[index] != 0;
        }

        /// <summary>
        /// Converts chunk-based VoxelFrames into a single global selection array for a layer.
        /// This is used for operations that need the full layer selection data.
        /// </summary>
        public static byte[] ConvertFramesToGlobalArray(VoxelFrame[] frames, int xDim, int yDim, int zDim)
        {
            var result = new byte[xDim * yDim * zDim];

            foreach (var frame in frames)
            {
                var decompressed = VoxelCompression.Decompress(frame.VoxelData);

                for (int x = 0; x < frame.Dimensions.X; x++)
                {
                    for (int y = 0; y < frame.Dimensions.Y; y++)
                    {
                        for (int z = 0; z < frame.Dimensions.Z; z++)
                        {
                            var localIndex = CalculateVoxelIndex(x, y, z, frame.Dimensions.Y, frame.Dimensions.Z);
                            if (localIndex < decompressed.Length && decompressed[localIndex] != 0)
                            {
                                var worldX = frame.MinPos.X + x;
                                var worldY = frame.MinPos.Y + y;
                                var worldZ = frame.MinPos.Z + z;
                                var globalIndex = CalculateVoxelIndex(worldX, worldY, worldZ, yDim, zDim);
                                if (globalIndex < result.Length)
                                {
                                    result[globalIndex] = decompressed[localIndex];
                                }
                            }
                        }
                    }
                }
            }

            return result;
        }

        /// <summary>
        /// Converts a global selection array into chunk-based VoxelFrames.
        /// Only creates frames for chunks that have non-zero selection data.
        /// </summary>
        public static VoxelFrame[] ConvertGlobalArrayToFrames(byte[] globalSelectionData, int xDim, int yDim, int zDim)
        {
            var frames = new List<VoxelFrame>();
            var processedChunks = new HashSet<string>();

            // Iterate through all positions to find selected voxels
            for (int globalIndex = 0; globalIndex < globalSelectionData.Length; globalIndex++)
            {
                if (globalSelectionData[globalIndex] == 0) continue;

                // Convert global index to position
                var x = globalIndex / (yDim * zDim);
                var y = (globalIndex % (yDim * zDim)) / zDim;
                var z = globalIndex % zDim;
                var position = new Vector3(x, y, z);

                // Calculate which chunk this belongs to
                var chunkMinPos = CalculateChunkMinPosition(position);
                var chunkKey = $"{chunkMinPos.X},{chunkMinPos.Y},{chunkMinPos.Z}";

                // Skip if we already processed this chunk
                if (processedChunks.Contains(chunkKey)) continue;
                processedChunks.Add(chunkKey);

                // Calculate chunk dimensions (may be smaller at edges)
                var chunkDimensions = new Vector3(
                    Math.Min(MAX_CHUNK_SIZE, xDim - chunkMinPos.X),
                    Math.Min(MAX_CHUNK_SIZE, yDim - chunkMinPos.Y),
                    Math.Min(MAX_CHUNK_SIZE, zDim - chunkMinPos.Z)
                );

                // Extract selection data for this chunk
                var chunkData = new byte[chunkDimensions.X * chunkDimensions.Y * chunkDimensions.Z];
                for (int cx = 0; cx < chunkDimensions.X; cx++)
                {
                    for (int cy = 0; cy < chunkDimensions.Y; cy++)
                    {
                        for (int cz = 0; cz < chunkDimensions.Z; cz++)
                        {
                            var worldX = chunkMinPos.X + cx;
                            var worldY = chunkMinPos.Y + cy;
                            var worldZ = chunkMinPos.Z + cz;
                            var worldIndex = CalculateVoxelIndex(worldX, worldY, worldZ, yDim, zDim);
                            var chunkIndex = CalculateVoxelIndex(cx, cy, cz, chunkDimensions.Y, chunkDimensions.Z);
                            
                            if (worldIndex < globalSelectionData.Length)
                            {
                                chunkData[chunkIndex] = globalSelectionData[worldIndex];
                            }
                        }
                    }
                }

                // Only add frame if it has non-zero data
                if (chunkData.Any(b => b != 0))
                {
                    frames.Add(CreateSelectionFrame(chunkMinPos, chunkDimensions, chunkData));
                }
            }

            return frames.ToArray();
        }

        /// <summary>
        /// Updates or adds a VoxelFrame for a specific chunk position in the selection frames array.
        /// If a frame already exists for this chunk, it is replaced. Otherwise, a new frame is added.
        /// </summary>
        public static VoxelFrame[] UpdateSelectionFrame(VoxelFrame[] existingFrames, Vector3 chunkMinPos, Vector3 chunkDimensions, byte[] selectionData)
        {
            var frames = existingFrames.ToList();
            
            // Remove existing frame for this chunk if present
            frames.RemoveAll(f => f.MinPos.X == chunkMinPos.X && 
                                 f.MinPos.Y == chunkMinPos.Y && 
                                 f.MinPos.Z == chunkMinPos.Z);

            // Only add new frame if it has non-zero data
            if (selectionData.Any(b => b != 0))
            {
                frames.Add(CreateSelectionFrame(chunkMinPos, chunkDimensions, selectionData));
            }

            return frames.ToArray();
        }
    }
}
