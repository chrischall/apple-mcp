/**
 * Tests that user-supplied strings are properly escaped before being
 * interpolated into AppleScript. These tests mock `run-applescript` to
 * capture the generated script text and verify it contains the correctly
 * escaped form of each input.
 *
 * The classic vulnerability: quote-only escaping (`s.replace(/"/g, '\\"')`)
 * leaves backslashes unhandled. An input like `\"` becomes `\\"` in the
 * script, where AppleScript's `\\` is a literal backslash and the following
 * `"` CLOSES the string — breaking out of the string context.
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { escapeAppleScriptString } from "../../utils/applescript-utils.js";

const capturedScripts: string[] = [];

// Must be declared before module imports so Bun can hoist the mock.
mock.module("run-applescript", () => ({
  runAppleScript: async (script: string) => {
    capturedScripts.push(script);
    // Access-check scripts just do `return name`.
    if (/return name/.test(script)) return "AppName";
    // Reminders creation
    if (script.includes("make new reminder")) return "SUCCESS:Reminders";
    // Mail search returns an empty list
    if (script.includes("set emailList")) return [];
    // Notes creation
    if (script.includes("make new note") || script.includes("set actualFolderName"))
      return "SUCCESS:Claude:false";
    // getNotesFromFolder
    if (script.includes("set notesList")) return "SUCCESS:0";
    return "";
  },
}));

// ── helpers ──────────────────────────────────────────────────────────────────

/** Return the first captured script that contains `substring`. */
function scriptWith(substring: string): string | undefined {
  return capturedScripts.find((s) => s.includes(substring));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("AppleScript injection prevention", () => {
  beforeEach(() => {
    capturedScripts.length = 0;
  });

  // ── reminders ──────────────────────────────────────────────────────────────

  describe("reminders.createReminder", () => {
    it("escapes a backslash in the reminder name", async () => {
      const reminders = (await import("../../utils/reminders.js")).default;

      const name = "foo\\bar"; // contains a literal backslash
      await reminders.createReminder({ name });

      const script = scriptWith("make new reminder");
      expect(script).toBeDefined();

      // The backslash must be doubled in the script.
      const escaped = escapeAppleScriptString(name);
      expect(script).toContain(escaped);
      // And the raw (unescaped) form must not appear inside a quoted value.
      expect(script).not.toContain(`"${name}"`);
    });

    it("escapes a backslash-quote sequence in the reminder name (classic bypass)", async () => {
      const reminders = (await import("../../utils/reminders.js")).default;

      // `\\"` in JS source = the 2-char string `\"` (backslash + double-quote).
      // Quote-only escaping produces `\\"` in the script, where `\\` is a
      // literal backslash and `"` then CLOSES the AppleScript string — injection!
      const name = '\\"evil';
      await reminders.createReminder({ name });

      const script = scriptWith("make new reminder");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(name);
      expect(script).toContain(escaped);
    });
  });

  // ── mail ───────────────────────────────────────────────────────────────────

  describe("mail.searchMails", () => {
    it("escapes a double-quote in the search term", async () => {
      const mail = (await import("../../utils/mail.js")).default;

      const searchTerm = 'hello"world';
      await mail.searchMails(searchTerm);

      const script = scriptWith("set searchTerm");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(searchTerm.toLowerCase());
      expect(script).toContain(escaped);
      // Raw unescaped quote must not appear in the interpolated value.
      expect(script).not.toMatch(/set searchTerm to "hello"world"/);
    });

    it("escapes a backslash in the search term", async () => {
      const mail = (await import("../../utils/mail.js")).default;

      const searchTerm = "back\\slash";
      await mail.searchMails(searchTerm);

      const script = scriptWith("set searchTerm");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(searchTerm.toLowerCase());
      expect(script).toContain(escaped);
    });
  });

  // ── notes ──────────────────────────────────────────────────────────────────

  describe("notes.createNote — folderName", () => {
    it("escapes a double-quote in the folder name", async () => {
      const notes = (await import("../../utils/notes.js")).default;

      const folderName = 'My"Notes';
      await notes.createNote("Title", "Body", folderName);

      // The folder name appears in multiple places; check the first assignment.
      const script = scriptWith("set actualFolderName");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(folderName);
      // Every interpolation of folderName must use the escaped form.
      expect(script).toContain(escaped);
      // The unescaped form must not appear in any quoted position.
      expect(script).not.toMatch(new RegExp(`"${folderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    });

    it("escapes a backslash-quote sequence in the folder name", async () => {
      const notes = (await import("../../utils/notes.js")).default;

      const folderName = '\\"hack';
      await notes.createNote("Title", "Body", folderName);

      const script = scriptWith("set actualFolderName");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(folderName);
      expect(script).toContain(escaped);
    });
  });

  describe("notes.createNote — title", () => {
    it("escapes a backslash-quote sequence in the note title", async () => {
      const notes = (await import("../../utils/notes.js")).default;

      // Quote-only escape converts `\"` to `\\"`, which in AppleScript means
      // a literal backslash followed by a string-closing `"` — injection!
      const title = '\\"injected';
      await notes.createNote(title, "body");

      const script = scriptWith("make new note");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(title);
      expect(script).toContain(escaped);
    });

    it("escapes a backslash in the note title", async () => {
      const notes = (await import("../../utils/notes.js")).default;

      const title = "back\\slash title";
      await notes.createNote(title, "body");

      const script = scriptWith("make new note");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(title);
      expect(script).toContain(escaped);
    });
  });

  describe("notes.getNotesFromFolder — folderName", () => {
    it("escapes a double-quote in the folder name", async () => {
      const notes = (await import("../../utils/notes.js")).default;

      const folderName = 'Bad"Folder';
      await notes.getNotesFromFolder(folderName);

      const script = scriptWith("set notesList");
      expect(script).toBeDefined();

      const escaped = escapeAppleScriptString(folderName);
      expect(script).toContain(escaped);
    });
  });
});
