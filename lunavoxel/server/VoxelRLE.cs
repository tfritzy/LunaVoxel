using System;
using System.Collections.Generic;

public static class VoxelRLE
{
    public static short[] Compress(uint[] voxelData)
    {
        if (voxelData.Length == 0)
            throw new ArgumentException("Voxel data must not be empty");

        var compressed = new List<short>();
        int i = 0;

        while (i < voxelData.Length)
        {
            uint value = voxelData[i];
            int runLength = 1;
            int j = i + 1;

            while (j < voxelData.Length &&
                   voxelData[j] == value &&
                   runLength < short.MaxValue)
            {
                runLength++;
                j++;
            }

            // Split 32-bit voxel value into two 16-bit values
            short valueLow = (short)(value & 0xFFFF);
            short valueHigh = (short)((value >> 16) & 0xFFFF);
            short runLengthShort = (short)runLength;

            compressed.Add(valueLow);
            compressed.Add(valueHigh);
            compressed.Add(runLengthShort);
            i = j;
        }

        return compressed.ToArray();
    }

    public static uint[] Decompress(short[] compressedData)
    {
        if (compressedData.Length % 3 != 0)
            throw new ArgumentException("Compressed data must be in triplets (valueLow, valueHigh, count)");

        var decompressed = new List<uint>();

        for (int i = 0; i < compressedData.Length; i += 3)
        {
            short valueLow = compressedData[i];
            short valueHigh = compressedData[i + 1];
            short runLength = compressedData[i + 2];

            // Reconstruct 32-bit value from two 16-bit values
            uint value = (uint)((valueLow & 0xFFFF) | ((valueHigh & 0xFFFF) << 16));

            for (int j = 0; j < runLength; j++)
            {
                decompressed.Add(value);
            }
        }

        return decompressed.ToArray();
    }


    public static uint GetVoxelAt(short[] compressedData, int voxelIndex)
    {
        if (compressedData.Length % 3 != 0)
            throw new ArgumentException("Compressed data must be in triplets (valueLow, valueHigh, count)");

        if (voxelIndex < 0)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex));

        int currentVoxelIndex = 0;

        for (int i = 0; i < compressedData.Length; i += 3)
        {
            short valueLow = compressedData[i];
            short valueHigh = compressedData[i + 1];
            short runLength = compressedData[i + 2];

            if (voxelIndex < currentVoxelIndex + runLength)
            {
                // Reconstruct 32-bit value from two 16-bit values
                return (uint)((valueLow & 0xFFFF) | ((valueHigh & 0xFFFF) << 16));
            }

            currentVoxelIndex += runLength;
        }

        throw new ArgumentOutOfRangeException(nameof(voxelIndex), "Voxel index is beyond the compressed data range");
    }
}