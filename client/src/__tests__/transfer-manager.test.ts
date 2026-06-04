import { describe, expect, test } from "bun:test";
import { formatBytes } from "../lib/utils";
import { isFileEncrypted } from "../lib/file-utils";

describe("formatBytes", () => {
  test("handles zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  test("handles exact boundaries", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });

  test("handles decimal values", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  test("handles very large numbers", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1 TB");
  });

  test("handles negative returns 0 B", () => {
    expect(formatBytes(-1)).toBe("0 B");
  });
});

describe("File metadata validation patterns", () => {
  test("empty file size should have 0 chunks", () => {
    const totalChunks = Math.ceil(0 / (8192 * 1024));
    expect(totalChunks).toBe(0);
  });

  test("small file should produce 1 chunk", () => {
    const totalChunks = Math.ceil(100 / (8192 * 1024));
    expect(totalChunks).toBe(1);
  });

  test("file exactly at chunk boundary", () => {
    const totalChunks = Math.ceil(8192 * 1024 / (8192 * 1024));
    expect(totalChunks).toBe(1);
  });

  test("file just over chunk boundary", () => {
    const totalChunks = Math.ceil((8192 * 1024 + 1) / (8192 * 1024));
    expect(totalChunks).toBe(2);
  });
});
