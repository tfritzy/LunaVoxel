using System;
using System.Collections.Generic;
using System.IO;
using K4os.Compression.LZ4;
using K4os.Compression.LZ4.Streams;
using SpacetimeDB;

public static class VoxelCompression
{
    public static byte[] Compress(byte[] voxelData)
    {
        if (voxelData.Length == 0)
            throw new ArgumentException("Voxel data must not be empty");

        // First apply RLE compression
        byte[] rleCompressed = RLECompress(voxelData);

        // Then apply LZ4 compression to RLE data
        using (var outputStream = new MemoryStream())
        {
            using (var lz4Stream = LZ4Stream.Encode(outputStream, LZ4Level.L00_FAST))
            {
                lz4Stream.Write(rleCompressed, 0, rleCompressed.Length);
            }
            return outputStream.ToArray();
        }
    }

    private static byte[] RLECompress(byte[] voxelData)
    {
        var compressed = new List<byte>();

        // Store original array length first (4 bytes)
        compressed.Add((byte)(voxelData.Length & 0xFF));
        compressed.Add((byte)((voxelData.Length >> 8) & 0xFF));
        compressed.Add((byte)((voxelData.Length >> 16) & 0xFF));
        compressed.Add((byte)((voxelData.Length >> 24) & 0xFF));

        int i = 0;
        while (i < voxelData.Length)
        {
            byte value = voxelData[i];
            int runLength = 1;
            int j = i + 1;

            while (j < voxelData.Length && voxelData[j] == value && runLength < ushort.MaxValue)
            {
                runLength++;
                j++;
            }

            ushort runLengthUShort = (ushort)runLength;

            compressed.Add(value);
            compressed.Add((byte)(runLengthUShort & 0xFF));
            compressed.Add((byte)((runLengthUShort >> 8) & 0xFF));

            i = j;
        }

        return compressed.ToArray();
    }

    public static byte[] Decompress(byte[] compressedData)
    {
        // First decompress LZ4
        byte[] rleData;
        using (var inputStream = new MemoryStream(compressedData))
        using (var lz4Stream = LZ4Stream.Decode(inputStream))
        using (var outputStream = new MemoryStream())
        {
            lz4Stream.CopyTo(outputStream);
            rleData = outputStream.ToArray();
        }

        // Then decompress RLE
        return RLEDecompress(rleData);
    }

    private static byte[] RLEDecompress(byte[] rleData)
    {
        // Read original array length
        int originalLength = rleData[0] |
                           (rleData[1] << 8) |
                           (rleData[2] << 16) |
                           (rleData[3] << 24);

        var decompressed = new List<byte>(originalLength);
        int dataStartIndex = 4;

        if ((rleData.Length - dataStartIndex) % 3 != 0)
            throw new ArgumentException("RLE data must be in 3-byte groups");

        for (int i = dataStartIndex; i < rleData.Length; i += 3)
        {
            byte value = rleData[i];
            ushort runLength = (ushort)(rleData[i + 1] | (rleData[i + 2] << 8));

            for (int j = 0; j < runLength; j++)
            {
                decompressed.Add(value);
            }
        }

        return decompressed.ToArray();
    }

    public static byte GetVoxelAt(byte[] compressedData, int voxelIndex)
    {
        if (voxelIndex < 0)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex));

        byte[] decompressedData = Decompress(compressedData);

        if (voxelIndex >= decompressedData.Length)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex), "Voxel index is beyond the data range");

        return decompressedData[voxelIndex];
    }
}