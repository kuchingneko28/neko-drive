import { describe, expect, test } from "bun:test";
import { getFileType, isFileEncrypted, getFileIcon } from "../lib/file-utils";

describe("getFileType", () => {
  test("detects images", () => {
    expect(getFileType("photo.png")).toBe("image");
    expect(getFileType("photo.jpg")).toBe("image");
    expect(getFileType("photo.webp")).toBe("image");
  });

  test("detects videos", () => {
    expect(getFileType("video.mp4")).toBe("video");
    expect(getFileType("video.mov")).toBe("video");
  });

  test("detects audio", () => {
    expect(getFileType("song.mp3")).toBe("audio");
    expect(getFileType("song.wav")).toBe("audio");
  });

  test("detects pdf", () => {
    expect(getFileType("doc.pdf")).toBe("pdf");
  });

  test("detects text", () => {
    expect(getFileType("notes.txt")).toBe("text");
    expect(getFileType("readme.md")).toBe("text");
  });

  test("detects code", () => {
    expect(getFileType("app.ts")).toBe("code");
    expect(getFileType("index.js")).toBe("code");
    expect(getFileType("style.css")).toBe("code");
    expect(getFileType("main.py")).toBe("code");
  });

  test("returns other for unknown", () => {
    expect(getFileType("file.xyz")).toBe("other");
    expect(getFileType(".dotfile")).toBe("other");
  });

  test("handles empty name", () => {
    expect(getFileType("")).toBe("other");
  });
});

describe("isFileEncrypted", () => {
  test("returns true for valid hex iv and salt", () => {
    expect(
      isFileEncrypted({
        iv: "0123456789abcdef0123456789abcdef",
        salt: "abcdef0123456789abcdef0123456789",
      }),
    ).toBe(true);
  });

  test("returns false for null iv", () => {
    expect(
      isFileEncrypted({ iv: null, salt: "abcdef0123456789abcdef0123456789" }),
    ).toBe(false);
  });

  test("returns false for null salt", () => {
    expect(
      isFileEncrypted({ iv: "0123456789abcdef0123456789abcdef", salt: null }),
    ).toBe(false);
  });

  test("returns false for empty strings", () => {
    expect(isFileEncrypted({ iv: "", salt: "" })).toBe(false);
  });

  test("returns false for all zeros", () => {
    expect(
      isFileEncrypted({
        iv: "00000000000000000000000000000000",
        salt: "00000000000000000000000000000000",
      }),
    ).toBe(false);
  });
});

describe("getFileIcon", () => {
  test("returns an element for image files", () => {
    const icon = getFileIcon("photo.png");
    expect(icon).toBeDefined();
  });

  test("returns an element for video files", () => {
    const icon = getFileIcon("video.mp4");
    expect(icon).toBeDefined();
  });

  test("returns an element for unknown files", () => {
    const icon = getFileIcon("file.xyz");
    expect(icon).toBeDefined();
  });
});
