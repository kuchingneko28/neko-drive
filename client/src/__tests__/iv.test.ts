import { describe, expect, test } from "bun:test";
import { chunkIv, hexToBytes } from "../lib/iv";

describe("chunkIv - per-chunk AES-GCM IV derivation", () => {
  const FILE_IV = "00112233445566778899aabbccddeeff";

  test("keeps the first 12 bytes of the file IV (random prefix)", () => {
    const iv = chunkIv(FILE_IV, 0);
    expect(Array.from(iv.slice(0, 12))).toEqual([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb]);
  });

  test("last 4 bytes encode the chunk index big-endian", () => {
    const iv = chunkIv(FILE_IV, 1);
    expect(Array.from(iv.slice(12))).toEqual([0, 0, 0, 1]);
    const iv2 = chunkIv(FILE_IV, 258);
    expect(Array.from(iv2.slice(12))).toEqual([0, 0, 1, 2]);
  });

  test("every chunk index yields a distinct IV", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(Array.from(chunkIv(FILE_IV, i)).join(","));
    }
    expect(seen.size).toBe(1000);
  });

  test("is deterministic (same index + file IV always produces same chunk IV)", () => {
    expect(chunkIv(FILE_IV, 7)).toEqual(chunkIv(FILE_IV, 7));
  });

  test("different file IVs produce different chunk IVs", () => {
    expect(chunkIv(FILE_IV, 3)).not.toEqual(chunkIv("10112233445566778899aabbccddeeff", 3));
  });
});

describe("hexToBytes", () => {
  test("parses hex into bytes", () => {
    expect(Array.from(hexToBytes("00ff10"))).toEqual([0x00, 0xff, 0x10]);
  });
});
