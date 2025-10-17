using System;
using System.Collections.Generic;
using System.IO;
using K4os.Compression.LZ4.Streams;

public static class NormalCompression
{
    public static byte[] Compress(uint[] data)
    {
        var rleData = RunLengthEncode(data);

        using (var ms = new MemoryStream())
        using (var lz4 = LZ4Stream.Encode(ms))
        {
            lz4.Write(rleData, 0, rleData.Length);
            lz4.Flush();
            return ms.ToArray();
        }
    }

    public static uint[] Decompress(byte[] compressed)
    {
        using (var input = new MemoryStream(compressed))
        using (var lz4 = LZ4Stream.Decode(input))
        using (var output = new MemoryStream())
        {
            lz4.CopyTo(output);
            return RunLengthDecode(output.ToArray());
        }
    }

    private static byte[] RunLengthEncode(uint[] data)
    {
        var encoded = new List<byte>();

        for (int i = 0; i < data.Length;)
        {
            uint value = data[i];
            int count = 1;

            while (i + count < data.Length && data[i + count] == value && count < ushort.MaxValue)
                count++;

            encoded.AddRange(BitConverter.GetBytes((ushort)count));
            encoded.AddRange(BitConverter.GetBytes(value));

            i += count;
        }

        return encoded.ToArray();
    }

    private static uint[] RunLengthDecode(byte[] data)
    {
        var decoded = new List<uint>();

        for (int i = 0; i < data.Length; i += 6)
        {
            ushort count = BitConverter.ToUInt16(data, i);
            uint value = BitConverter.ToUInt32(data, i + 2);

            for (int j = 0; j < count; j++)
                decoded.Add(value);
        }

        return decoded.ToArray();
    }
}