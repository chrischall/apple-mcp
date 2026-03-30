import { describe, it, expect } from "bun:test";
import { escapeAppleScriptString, formatDateForAppleScript } from "../../utils/applescript-utils.js";

describe("escapeAppleScriptString", () => {
  it("leaves plain strings unchanged", () => {
    expect(escapeAppleScriptString("hello world")).toBe("hello world");
  });

  it("escapes double-quotes", () => {
    expect(escapeAppleScriptString('say "hi"')).toBe('say \\"hi\\"');
  });

  it("escapes backslashes", () => {
    expect(escapeAppleScriptString("C:\\Users\\test")).toBe("C:\\\\Users\\\\test");
  });

  it("escapes backslash before double-quote (order matters)", () => {
    // Input: \"  →  should become \\\"  (escaped backslash, then escaped quote)
    expect(escapeAppleScriptString('\\"')).toBe('\\\\\\"');
  });

  it("handles empty string", () => {
    expect(escapeAppleScriptString("")).toBe("");
  });

  it("handles string with only special characters", () => {
    expect(escapeAppleScriptString('"\\"')).toBe('\\"\\\\\\"');
  });

  it("injection: AppleScript end tell breakout attempt", () => {
    // A classic AppleScript injection: closing the string and injecting commands
    const malicious = '" end tell\ntell application "Finder" to delete every file';
    const escaped = escapeAppleScriptString(malicious);
    // The leading " must be escaped so it can't close the outer string
    expect(escaped.startsWith('\\"')).toBe(true);
    // The result must not contain an unescaped " at position 0
    expect(escaped[0]).not.toBe('"');
  });

  it("injection: script comment breakout", () => {
    const malicious = 'test" -- comment injection';
    const escaped = escapeAppleScriptString(malicious);
    expect(escaped).not.toContain('" --');
  });

  it("handles unicode/emoji", () => {
    const result = escapeAppleScriptString("Hello 🚀 世界");
    expect(result).toBe("Hello 🚀 世界");
  });

  it("handles newlines (passes through — must be handled by caller)", () => {
    // Newlines within AppleScript strings are valid, just pass through
    const result = escapeAppleScriptString("line1\nline2");
    expect(result).toBe("line1\nline2");
  });
});

describe("formatDateForAppleScript", () => {
  it("returns a string", () => {
    const d = new Date("2026-03-30T14:30:00");
    expect(typeof formatDateForAppleScript(d)).toBe("string");
  });

  it("output does not contain double-quotes", () => {
    const d = new Date("2026-03-30T14:30:00");
    expect(formatDateForAppleScript(d)).not.toContain('"');
  });

  it("output does not contain backslashes", () => {
    const d = new Date("2026-03-30T14:30:00");
    expect(formatDateForAppleScript(d)).not.toContain("\\");
  });

  it("output contains the year", () => {
    const d = new Date("2026-03-30T14:30:00");
    expect(formatDateForAppleScript(d)).toContain("2026");
  });

  it("is locale-independent (always en-US month name)", () => {
    const d = new Date("2026-03-30T14:30:00");
    expect(formatDateForAppleScript(d)).toContain("March");
  });

  it("output is consistent across calls", () => {
    const d = new Date("2026-06-15T09:00:00");
    expect(formatDateForAppleScript(d)).toBe(formatDateForAppleScript(d));
  });
});
