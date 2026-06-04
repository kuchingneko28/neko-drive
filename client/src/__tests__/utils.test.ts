import { describe, expect, test } from "bun:test";
import { formatBytes, formatRelativeDate } from "../lib/utils";

describe("formatBytes", () => {
  test("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  test("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  test("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2 KB");
  });

  test("formats megabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });

  test("formats gigabytes", () => {
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3 GB");
  });
});

describe("formatRelativeDate", () => {
  const now = Date.now();

  test('returns "Today" for today', () => {
    expect(formatRelativeDate(now)).toBe("Today");
  });

  test('returns "Yesterday" for 1 day ago', () => {
    expect(formatRelativeDate(now - 86400000)).toBe("Yesterday");
  });

  test('returns "3d ago" for 3 days ago', () => {
    expect(formatRelativeDate(now - 3 * 86400000)).toBe("3d ago");
  });

  test("returns formatted date for older dates", () => {
    const old = new Date("2024-01-15").getTime();
    const result = formatRelativeDate(old);
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });
});
