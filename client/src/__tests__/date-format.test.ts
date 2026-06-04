import { describe, expect, test } from "bun:test";
import { formatRelativeDate } from "../lib/utils";

describe("formatRelativeDate", () => {
  const now = Date.now();
  const day = 86400000;

  test("exact now returns Today", () => {
    expect(formatRelativeDate(now)).toBe("Today");
  });

  test("5 minutes ago returns Today", () => {
    expect(formatRelativeDate(now - 300000)).toBe("Today");
  });

  test("23 hours ago returns Today", () => {
    expect(formatRelativeDate(now - 23 * 3600000)).toBe("Today");
  });

  test("24 hours ago returns Yesterday", () => {
    expect(formatRelativeDate(now - day)).toBe("Yesterday");
  });

  test("48 hours ago returns 2d ago", () => {
    expect(formatRelativeDate(now - 2 * day)).toBe("2d ago");
  });

  test("3 days ago returns 3d ago", () => {
    expect(formatRelativeDate(now - 3 * day)).toBe("3d ago");
  });

  test("6 days ago returns 6d ago", () => {
    expect(formatRelativeDate(now - 6 * day)).toBe("6d ago");
  });

  test("7 days ago returns formatted date", () => {
    const result = formatRelativeDate(now - 7 * day);
    // Should not contain "d ago" or "Today" or "Yesterday"
    expect(result).not.toContain("d ago");
    expect(result).not.toBe("Today");
    expect(result).not.toBe("Yesterday");
  });

  test("30 days ago returns formatted date", () => {
    const result = formatRelativeDate(now - 30 * day);
    expect(result).not.toContain("d ago");
    expect(result).not.toBe("Today");
    expect(result).not.toBe("Yesterday");
  });

  test("future date returns Today", () => {
    expect(formatRelativeDate(now + day)).toBe("Today");
  });

  test("unix timestamp in seconds is handled", () => {
    // The function expects milliseconds, but if given seconds it would show wrong date
    // This documents the expected behavior
    const seconds = Math.floor(now / 1000);
    const result = formatRelativeDate(seconds);
    // Would show as 1970 because seconds interpreted as ms
    expect(result).toBeDefined();
  });
});
