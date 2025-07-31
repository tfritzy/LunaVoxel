using System;
using System.Collections.Generic;

public static class VoxelRLE
{
    public static byte[] Compress(byte[] voxelData)
    {
        if (voxelData.Length == 0 || voxelData.Length % 2 != 0)
            throw new ArgumentException("Voxel data must have even length (2 bytes per voxel)");

        var compressed = new List<byte>();
        int i = 0;

        while (i < voxelData.Length)
        {
            byte byte1 = voxelData[i];
            byte byte2 = voxelData[i + 1];

            int runLength = 1;
            int j = i + 2;

            while (j < voxelData.Length - 1 &&
                   voxelData[j] == byte1 &&
                   voxelData[j + 1] == byte2 &&
                   runLength < 65535)
            {
                runLength++;
                j += 2;
            }

            compressed.Add((byte)(runLength & 0xFF));
            compressed.Add((byte)((runLength >> 8) & 0xFF));
            compressed.Add(byte1);
            compressed.Add(byte2);

            i = j;
        }

        return compressed.ToArray();
    }

    public static byte[] Decompress(byte[] compressedData)
    {
        if (compressedData.Length % 4 != 0)
            throw new ArgumentException("Compressed data must be in groups of 4 bytes (2 bytes for count, 2 bytes for voxel)");

        var decompressed = new List<byte>();

        for (int i = 0; i < compressedData.Length; i += 4)
        {
            int runLength = compressedData[i] | (compressedData[i + 1] << 8);
            byte byte1 = compressedData[i + 2];
            byte byte2 = compressedData[i + 3];

            for (int j = 0; j < runLength; j++)
            {
                decompressed.Add(byte1);
                decompressed.Add(byte2);
            }
        }

        return decompressed.ToArray();
    }

    public static void CompressInPlace(ref byte[] voxelData)
    {
        voxelData = Compress(voxelData);
    }

    public static byte[] GetVoxelAt(byte[] compressedData, int voxelIndex)
    {
        if (compressedData.Length % 4 != 0)
            throw new ArgumentException("Compressed data must be in groups of 4 bytes (2 bytes for count, 2 bytes for voxel)");

        if (voxelIndex < 0)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex));

        int currentVoxelIndex = 0;

        for (int i = 0; i < compressedData.Length; i += 4)
        {
            int runLength = compressedData[i] | (compressedData[i + 1] << 8);

            if (voxelIndex < currentVoxelIndex + runLength)
            {
                return new byte[] { compressedData[i + 2], compressedData[i + 3] };
            }

            currentVoxelIndex += runLength;
        }

        throw new ArgumentOutOfRangeException(nameof(voxelIndex), "Voxel index is beyond the compressed data range");
    }
}