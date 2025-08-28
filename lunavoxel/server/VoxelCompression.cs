using System;
using System.Collections.Generic;
using System.IO;
using K4os.Compression.LZ4;
using K4os.Compression.LZ4.Streams;
using SpacetimeDB;

public static class VoxelCompression
{
    public static byte[] Compress(uint[] voxelData)
    {
        if (voxelData.Length == 0)
            throw new ArgumentException("Voxel data must not be empty");

        // Convert uint array to byte array for LZ4-only compression
        byte[] originalBytes = new byte[voxelData.Length * sizeof(uint)];
        Buffer.BlockCopy(voxelData, 0, originalBytes, 0, originalBytes.Length);

        // Apply LZ4-only compression for stats
        byte[] lz4OnlyCompressed;
        using (var outputStream = new MemoryStream())
        {
            using (var lz4Stream = LZ4Stream.Encode(outputStream, LZ4Level.L00_FAST))
            {
                lz4Stream.Write(originalBytes, 0, originalBytes.Length);
            }
            lz4OnlyCompressed = outputStream.ToArray();
        }

        // First apply RLE compression
        byte[] rleCompressed = RLECompress(voxelData);

        // Then apply LZ4 compression to RLE data
        byte[] rleLz4Compressed;
        using (var outputStream = new MemoryStream())
        {
            using (var lz4Stream = LZ4Stream.Encode(outputStream, LZ4Level.L00_FAST))
            {
                lz4Stream.Write(rleCompressed, 0, rleCompressed.Length);
            }
            rleLz4Compressed = outputStream.ToArray();
        }

        // Log compression stats
        int originalSize = voxelData.Length * sizeof(uint);
        double rleRatio = (double)originalSize / rleCompressed.Length;
        double lz4Ratio = (double)originalSize / lz4OnlyCompressed.Length;
        double combinedRatio = (double)originalSize / rleLz4Compressed.Length;

        Log.Info($"Raw: {originalSize:N0} | RLE: {rleCompressed.Length:N0} ({rleRatio:F1}x) | LZ4: {lz4OnlyCompressed.Length:N0} ({lz4Ratio:F1}x) | Combined: {rleLz4Compressed.Length:N0} ({combinedRatio:F1}x)");

        return rleLz4Compressed;
    }

    private static byte[] RLECompress(uint[] voxelData)
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
            uint value = voxelData[i];
            int runLength = 1;
            int j = i + 1;

            while (j < voxelData.Length && voxelData[j] == value && runLength < ushort.MaxValue)
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

    private static uint[] RLEDecompress(byte[] rleData)
    {
        // Read original array length
        int originalLength = rleData[0] |
                           (rleData[1] << 8) |
                           (rleData[2] << 16) |
                           (rleData[3] << 24);

        var decompressed = new List<uint>(originalLength);
        int dataStartIndex = 4;

        if ((rleData.Length - dataStartIndex) % 6 != 0)
            throw new ArgumentException("RLE data must be in 6-byte groups");

        for (int i = dataStartIndex; i < rleData.Length; i += 6)
        {
            ushort valueLow = (ushort)(rleData[i] | (rleData[i + 1] << 8));
            ushort valueHigh = (ushort)(rleData[i + 2] | (rleData[i + 3] << 8));
            ushort runLength = (ushort)(rleData[i + 4] | (rleData[i + 5] << 8));

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
        if (voxelIndex < 0)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex));

        uint[] decompressedData = Decompress(compressedData);

        if (voxelIndex >= decompressedData.Length)
            throw new ArgumentOutOfRangeException(nameof(voxelIndex), "Voxel index is beyond the data range");

        return decompressedData[voxelIndex];
    }

    public static byte[] CompressWithLevel(uint[] voxelData, LZ4Level level)
    {
        if (voxelData.Length == 0)
            throw new ArgumentException("Voxel data must not be empty");

        // First apply RLE compression
        byte[] rleCompressed = RLECompress(voxelData);

        // Then apply LZ4 compression with specified level
        using (var outputStream = new MemoryStream())
        {
            using (var lz4Stream = LZ4Stream.Encode(outputStream, level))
            {
                lz4Stream.Write(rleCompressed, 0, rleCompressed.Length);
            }
            return outputStream.ToArray();
        }
    }

    public static CompressionStats GetCompressionStats(uint[] original, byte[] compressed)
    {
        int originalSize = original.Length * sizeof(uint);
        int compressedSize = compressed.Length;
        double ratio = (double)originalSize / compressedSize;
        double percentSaved = (1.0 - (double)compressedSize / originalSize) * 100;

        return new CompressionStats
        {
            OriginalSize = originalSize,
            CompressedSize = compressedSize,
            CompressionRatio = ratio,
            PercentageSaved = percentSaved
        };
    }

    public struct CompressionStats
    {
        public int OriginalSize { get; set; }
        public int CompressedSize { get; set; }
        public double CompressionRatio { get; set; }
        public double PercentageSaved { get; set; }

        public override string ToString()
        {
            return $"Original: {OriginalSize:N0} bytes, Compressed: {CompressedSize:N0} bytes, " +
                   $"Ratio: {CompressionRatio:F2}x, Saved: {PercentageSaved:F1}%";
        }
    }
}