import { describe, it, expect } from "bun:test";
import { normalizePhoneNumber, decodeAttributedBody } from "../../utils/phone-utils.js";

describe("normalizePhoneNumber", () => {
  describe("standard E.164 inputs", () => {
    it("returns +1XXXXXXXXXX unchanged", () => {
      expect(normalizePhoneNumber("+14805551234")).toEqual(["+14805551234"]);
    });

    it("handles 1XXXXXXXXXX → +1XXXXXXXXXX", () => {
      expect(normalizePhoneNumber("14805551234")).toEqual(["+14805551234"]);
    });

    it("handles 10-digit → +1XXXXXXXXXX", () => {
      expect(normalizePhoneNumber("4805551234")).toEqual(["+14805551234"]);
    });
  });

  describe("formatted inputs", () => {
    it("strips dashes", () => {
      expect(normalizePhoneNumber("480-555-1234")).toEqual(["+14805551234"]);
    });

    it("strips parentheses and spaces", () => {
      expect(normalizePhoneNumber("(480) 555-1234")).toEqual(["+14805551234"]);
    });

    it("strips dots", () => {
      expect(normalizePhoneNumber("480.555.1234")).toEqual(["+14805551234"]);
    });

    it("handles +1 with formatting", () => {
      expect(normalizePhoneNumber("+1 (480) 555-1234")).toEqual(["+14805551234"]);
    });
  });

  describe("output safety", () => {
    it("strips all non-digit/plus characters (injection safety)", () => {
      // Even if someone passes in shell metacharacters, they are stripped
      const result = normalizePhoneNumber("480;rm -rf /;555-1234");
      for (const n of result) {
        expect(n).toMatch(/^[0-9+]+$/);
      }
    });

    it("does not produce results with SQL metacharacters", () => {
      const result = normalizePhoneNumber("480' OR '1'='1");
      for (const n of result) {
        expect(n).not.toContain("'");
        expect(n).not.toContain(" ");
      }
    });

    it("handles empty string without throwing", () => {
      const result = normalizePhoneNumber("");
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles string of only non-digits without throwing", () => {
      const result = normalizePhoneNumber("abc-xyz");
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("decodeAttributedBody", () => {
  it("returns fallback for empty hex string", () => {
    const result = decodeAttributedBody("");
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe("string");
  });

  it("returns fallback for non-attributedBody hex", () => {
    // Hex-encoded "hello world" — not a real attributedBody blob
    const hex = Buffer.from("hello world").toString("hex");
    const result = decodeAttributedBody(hex);
    // Should not throw, returns some text or fallback
    expect(typeof result.text).toBe("string");
  });

  it("returns fallback for empty buffer", () => {
    const result = decodeAttributedBody("00");
    expect(typeof result.text).toBe("string");
  });

  it("url field is undefined when no URL found", () => {
    const hex = Buffer.from("no url here").toString("hex");
    const result = decodeAttributedBody(hex);
    expect(result.url).toBeUndefined();
  });

  it("detects http URLs in content", () => {
    const payload = 'some data https://example.com more data';
    const hex = Buffer.from(payload).toString("hex");
    const result = decodeAttributedBody(hex);
    expect(result.url).toBe("https://example.com");
  });

  it("does not throw on invalid hex", () => {
    expect(() => decodeAttributedBody("GGGG")).not.toThrow();
  });
});
