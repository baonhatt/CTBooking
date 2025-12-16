import { describe, it, expect } from "vitest";
import { PASSWORD_PATTERN } from "./Header";

describe("PASSWORD_PATTERN", () => {
  it("accepts letters and digits (min 6)", () => {
    expect(PASSWORD_PATTERN.test("abc123")).toBe(true);
    expect(PASSWORD_PATTERN.test("Abcdef123")).toBe(true);
  });

  it("accepts with special characters", () => {
    expect(PASSWORD_PATTERN.test("abc123!")).toBe(true);
    expect(PASSWORD_PATTERN.test("Passw0rd@2025")).toBe(true);
  });

  it("rejects without digits", () => {
    expect(PASSWORD_PATTERN.test("abcdef")).toBe(false);
    expect(PASSWORD_PATTERN.test("Password!!!")).toBe(false);
  });

  it("rejects without letters", () => {
    expect(PASSWORD_PATTERN.test("123456")).toBe(false);
    expect(PASSWORD_PATTERN.test("987654!@#")).toBe(false);
  });

  it("rejects length < 6", () => {
    expect(PASSWORD_PATTERN.test("a1b2")).toBe(false);
    expect(PASSWORD_PATTERN.test("A1@b")).toBe(false);
  });
});

