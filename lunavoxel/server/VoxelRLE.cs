using System;
using System.Collections.Generic;

public static class VoxelRLE
{
    public static byte[] Compress(uint[] voxelData)
    {
        if (voxelData.Length == 0)
            throw new ArgumentException("Voxel data must not be empty");

        var compressed = new List<byte>();
        int i = 0;

        while (i < voxelData.Length)
        {
            uint value = voxelData[i];
            int runLength = 1;
            int j = i + 1;

            while (j < voxelData.Length &&
                   voxelData[j] == value &&
                   runLength < ushort.MaxValue)
            {
                runLength++;
                j++;
            }

            ushort valueLow = (ushort)(value & 0xFFFF);
            ushort valueHigh = (ushort)((value >> 16) & 0xFFFF);
            ushort runLengthUShort = (ushort)runLength;

            compressed.Add((byte)(valueLow & 0xFF));
            compressed.Add((byte)((valueLow >> 8) & 0xFF));
            compressed.Add((byte)(valueHigh & 0xFF));
            compressed.Add((byte)((valueHigh >> 8) & 0xFF));
            compressed.Add((byte)(runLengthUShort & 0xFF));
            compressed.Add((byte)((runLengthUShort >> 8) & 0xFF));

            i = j;
        }

        return compressed.ToArray();
    }

    public static uint[] Decompress(byte[] compressedData)
    {
        if (compressedData.Length % 6 != 0)
            throw new ArgumentException("Compressed data must be in 6-byte groups (valueLow_bytes, valueHigh_bytes, runLength_bytes)");

        var decompressed = new List<uint>();

        for (int i = 0; i < compressedData.Length; i += 6)
        {
            ushort valueLow = (ushort)(compressedData[i] | (compressedData[i + 1] << 8));
            ushort valueHigh = (ushort)(compressedData[i + 2] | (compressedData[i + 3] << 8));
            ushort runLength = (ushort)(compressedData[i + 4] | (compressedData[i + 5] << 8));

            uint value = (uint)((valueLow & 0xFFFF) | ((valueHigh & 0xFFFF) << 16));

            for (int j = 0; j < runLength; j++)
            {
                decompressed.Add(value);
            }
        }

        return decompressed.ToArray();
    }

    public static uint GetVoxelAt(byte[] compressedData, int voxelIndex)
    {
        if (compressedData.Length % 6 != 0)
            throw new ArgumentException("Compressed data must be in 6-byte groups (valueLow_bytes, valueHigh_bytes, runLength_bytes)");

        if (voxelIndex < 0)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex));

        int currentVoxelIndex = 0;

        for (int i = 0; i < compressedData.Length; i += 6)
        {
            ushort valueLow = (ushort)(compressedData[i] | (compressedData[i + 1] << 8));
            ushort valueHigh = (ushort)(compressedData[i + 2] | (compressedData[i + 3] << 8));
            ushort runLength = (ushort)(compressedData[i + 4] | (compressedData[i + 5] << 8));

            if (voxelIndex < currentVoxelIndex + runLength)
            {
                return (uint)((valueLow & 0xFFFF) | ((valueHigh & 0xFFFF) << 16));
            }

            currentVoxelIndex += runLength;
        }

        throw new ArgumentOutOfRangeException(nameof(voxelIndex), "Voxel index is beyond the compressed data range");
    }
}