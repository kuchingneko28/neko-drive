import { describe, expect, test } from "bun:test";
import { getFileType, getFileIcon } from "../lib/file-utils";

describe("getFileType - edge cases", () => {
  test("empty filename returns other", () => {
    expect(getFileType("")).toBe("other");
  });

  test("no extension returns other", () => {
    expect(getFileType("file")).toBe("other");
  });

  test("dotfile returns other", () => {
    expect(getFileType(".gitignore")).toBe("other");
  });

  test("multiple dots uses last segment", () => {
    // .gz is in the archive list
    expect(getFileType("archive.tar.gz")).toBe("archive");
  });

  test("uppercase extension is handled", () => {
    expect(getFileType("photo.PNG")).toBe("image");
    expect(getFileType("video.MP4")).toBe("video");
    expect(getFileType("doc.PDF")).toBe("pdf");
  });

  test("very long filename", () => {
    const name = "a".repeat(200) + ".txt";
    expect(getFileType(name)).toBe("text");
  });

  test("filename with spaces", () => {
    expect(getFileType("my vacation photo.jpg")).toBe("image");
  });

  test("filename with special characters", () => {
    expect(getFileType("file (1).mp4")).toBe("video");
    expect(getFileType("doc-v1.2-final.pdf")).toBe("pdf");
  });

  test("known extension returns correct type", () => {
    const cases: [string, string][] = [
      ["png", "image"],
      ["jpg", "image"],
      ["jpeg", "image"],
      ["gif", "image"],
      ["webp", "image"],
      ["svg", "image"],
      ["mp4", "video"],
      ["webm", "video"],
      ["mov", "video"],
      ["mkv", "video"],
      ["mp3", "audio"],
      ["wav", "audio"],
      ["ogg", "audio"],
      ["pdf", "pdf"],
      ["txt", "text"],
      ["md", "text"],
      ["zip", "archive"],
      ["rar", "archive"],
      ["7z", "archive"],
      ["tar", "archive"],
      ["gz", "archive"],
      ["js", "code"],
      ["ts", "code"],
      ["tsx", "code"],
      ["py", "code"],
      ["html", "code"],
      ["css", "code"],
    ];
    for (const [ext, expected] of cases) {
      expect(getFileType(`file.${ext}`)).toBe(expected);
    }
  });
});

describe("getFileIcon", () => {
  test("returns a JSX element for every type", () => {
    const extensions = [
      "png",
      "mp4",
      "mp3",
      "pdf",
      "txt",
      "zip",
      "js",
      "unknown",
    ];
    for (const ext of extensions) {
      const icon = getFileIcon(`file.${ext}`);
      expect(icon).toBeDefined();
    }
  });
});
