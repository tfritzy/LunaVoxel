using System;
using System.Collections.Generic;

public static class VoxelRLE
{
    public static short[] Compress(short[] voxelData)
    {
        if (voxelData.Length == 0)
            throw new ArgumentException("Voxel data must not be empty");

        var compressed = new List<short>();
        int i = 0;

        while (i < voxelData.Length)
        {
            short value = voxelData[i];
            short runLength = 1;
            int j = i + 1;

            while (j < voxelData.Length &&
                   voxelData[j] == value &&
                   runLength < short.MaxValue)
            {
                runLength++;
                j++;
            }

            compressed.Add(runLength);
            compressed.Add(value);
            i = j;
        }

        return compressed.ToArray();
    }

    public static short[] Decompress(short[] compressedData)
    {
        if (compressedData.Length % 2 != 0)
            throw new ArgumentException("Compressed data must be in pairs (count, value)");

        var decompressed = new List<short>();

        for (int i = 0; i < compressedData.Length; i += 2)
        {
            short runLength = compressedData[i];
            short value = compressedData[i + 1];

            for (int j = 0; j < runLength; j++)
            {
                decompressed.Add(value);
            }
        }

        return decompressed.ToArray();
    }

    public static void CompressInPlace(ref short[] voxelData)
    {
        voxelData = Compress(voxelData);
    }

    public static short GetVoxelAt(short[] compressedData, int voxelIndex)
    {
        if (compressedData.Length % 2 != 0)
            throw new ArgumentException("Compressed data must be in pairs (count, value)");

        if (voxelIndex < 0)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex));

        int currentVoxelIndex = 0;

        for (int i = 0; i < compressedData.Length; i += 2)
        {
            short runLength = compressedData[i];

            if (voxelIndex < currentVoxelIndex + runLength)
            {
                return compressedData[i + 1];
            }

            currentVoxelIndex += runLength;
        }

        throw new ArgumentOutOfRangeException(nameof(voxelIndex), "Voxel index is beyond the compressed data range");
    }
}