import { describe, expect, test } from "bun:test";
import { isFileEncrypted } from "../lib/file-utils";

describe("isFileEncrypted - edge cases", () => {
  test("null iv and salt returns false", () => {
    expect(isFileEncrypted({ iv: null, salt: null })).toBe(false);
  });

  test("null iv with valid salt returns false", () => {
    expect(
      isFileEncrypted({ iv: null, salt: "abcdef0123456789abcdef0123456789" }),
    ).toBe(false);
  });

  test("valid iv with null salt returns false", () => {
    expect(
      isFileEncrypted({ iv: "0123456789abcdef0123456789abcdef", salt: null }),
    ).toBe(false);
  });

  test("empty strings returns false", () => {
    expect(isFileEncrypted({ iv: "", salt: "" })).toBe(false);
  });

  test("all zeros iv returns false", () => {
    expect(
      isFileEncrypted({
        iv: "00000000000000000000000000000000",
        salt: "abcdef0123456789abcdef0123456789",
      }),
    ).toBe(false);
  });

  test("all zeros salt returns false", () => {
    expect(
      isFileEncrypted({
        iv: "0123456789abcdef0123456789abcdef",
        salt: "00000000000000000000000000000000",
      }),
    ).toBe(false);
  });

  test("all zeros both returns false", () => {
    expect(
      isFileEncrypted({
        iv: "00000000000000000000000000000000",
        salt: "00000000000000000000000000000000",
      }),
    ).toBe(false);
  });

  test("short hex iv (under 24 chars) returns false", () => {
    expect(
      isFileEncrypted({ iv: "abc", salt: "abcdef0123456789abcdef0123456789" }),
    ).toBe(false);
  });

  test("short hex salt (under 24 chars) returns false", () => {
    expect(
      isFileEncrypted({ iv: "0123456789abcdef0123456789abcdef", salt: "abc" }),
    ).toBe(false);
  });

  test("non-hex characters returns false", () => {
    expect(
      isFileEncrypted({
        iv: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
        salt: "abcdef0123456789abcdef0123456789",
      }),
    ).toBe(false);
  });

  test("mixed case hex is valid", () => {
    expect(
      isFileEncrypted({
        iv: "AbCdEf0123456789AbCdEf0123456789",
        salt: "0123456789abcdef0123456789abcdef",
      }),
    ).toBe(true);
  });

  test("32-char hex iv is valid", () => {
    expect(
      isFileEncrypted({
        iv: "0123456789abcdef0123456789abcdef",
        salt: "0123456789abcdef0123456789abcdef",
      }),
    ).toBe(true);
  });

  test("64-char hex salt is valid", () => {
    expect(
      isFileEncrypted({
        iv: "0123456789abcdef0123456789abcdef",
        salt: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }),
    ).toBe(true);
  });
});
