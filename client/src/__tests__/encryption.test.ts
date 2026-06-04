import { describe, expect, test } from "bun:test";
import { isFileEncrypted } from "../lib/file-utils";

describe("isFileEncrypted - edge cases", () => {
  test("null iv and salt returns false", () => {
    expect(isFileEncrypted(null, null)).toBe(false);
  });

  test("null iv with valid salt returns false", () => {
    expect(isFileEncrypted(null, "abcdef0123456789abcdef0123456789")).toBe(false);
  });

  test("valid iv with null salt returns false", () => {
    expect(isFileEncrypted("0123456789abcdef0123456789abcdef", null)).toBe(false);
  });

  test("empty strings returns false", () => {
    expect(isFileEncrypted("", "")).toBe(false);
  });

  test("all zeros iv returns false", () => {
    expect(isFileEncrypted("00000000000000000000000000000000", "abcdef0123456789abcdef0123456789")).toBe(false);
  });

  test("all zeros salt returns false", () => {
    expect(isFileEncrypted("0123456789abcdef0123456789abcdef", "00000000000000000000000000000000")).toBe(false);
  });

  test("all zeros both returns false", () => {
    expect(isFileEncrypted("00000000000000000000000000000000", "00000000000000000000000000000000")).toBe(false);
  });

  test("short hex iv (under 24 chars) returns false", () => {
    expect(isFileEncrypted("abc", "abcdef0123456789abcdef0123456789")).toBe(false);
  });

  test("short hex salt (under 24 chars) returns false", () => {
    expect(isFileEncrypted("0123456789abcdef0123456789abcdef", "abc")).toBe(false);
  });

  test("non-hex characters returns false", () => {
    expect(isFileEncrypted("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz", "abcdef0123456789abcdef0123456789")).toBe(false);
  });

  test("mixed case hex is valid", () => {
    expect(isFileEncrypted("AbCdEf0123456789AbCdEf0123456789", "0123456789abcdef0123456789abcdef")).toBe(true);
  });

  test("32-char hex iv is valid", () => {
    expect(isFileEncrypted("0123456789abcdef0123456789abcdef", "0123456789abcdef0123456789abcdef")).toBe(true);
  });

  test("64-char hex salt is valid", () => {
    expect(isFileEncrypted("0123456789abcdef0123456789abcdef", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")).toBe(true);
  });
});
