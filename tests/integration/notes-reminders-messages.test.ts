// tests/integration/notes-reminders-messages.test.ts
import { describe, it, expect } from "bun:test";
import notesModule from "../../utils/notes.js";
import remindersModule from "../../utils/reminders.js";
import messageModule from "../../utils/message.js";

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

describe("notes_list_folders / listFolders", () => {
  it("returns array of NoteFolder objects", async () => {
    const folders = await notesModule.listFolders();
    expect(Array.isArray(folders)).toBe(true);
    for (const f of folders) {
      expect(typeof f.name).toBe("string");
    }
    console.log(`Found ${folders.length} folders`);
  }, 15000);
});

describe("notes_list / listNotes", () => {
  it("returns array of Note objects with correct shape", async () => {
    const notes = await notesModule.listNotes({});
    expect(Array.isArray(notes)).toBe(true);
    for (const n of notes) {
      expect(typeof n.name).toBe("string");
      expect(typeof n.folder).toBe("string");
      expect(typeof n.body).toBe("string");
    }
    console.log(`listNotes returned ${notes.length} notes`);
  }, 20000);

  it("respects limit param", async () => {
    const notes = await notesModule.listNotes({ limit: 2 });
    expect(notes.length).toBeLessThanOrEqual(2);
  }, 20000);
});

describe("notes_search / searchNotes", () => {
  it("returns array for any query", async () => {
    const notes = await notesModule.searchNotes({ query: "the" });
    expect(Array.isArray(notes)).toBe(true);
  }, 20000);

  it("returns empty array for impossible query", async () => {
    const notes = await notesModule.searchNotes({ query: "ZzZzImpossibleQuery99991" });
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBe(0);
  }, 20000);
});

describe("notes_get / getNote", () => {
  it("returns null for non-existent name", async () => {
    const result = await notesModule.getNote({ name: "ZzZzNonExistentNote99991" });
    expect(result).toBeNull();
  }, 90000);

  it("returns full Note for real note if one exists", async () => {
    const notes = await notesModule.listNotes({ limit: 1 });
    if (notes.length === 0) { console.log("No notes available"); return; }
    const note = await notesModule.getNote({ name: notes[0].name, folder: notes[0].folder });
    if (note) {
      expect(typeof note.name).toBe("string");
      expect(typeof note.folder).toBe("string");
      expect(typeof note.body).toBe("string");
    }
  }, 20000);
});

describe("notes_create / createNote", () => {
  it("returns boolean", async () => {
    const result = await notesModule.createNote({
      title: `MCP Test Note ${Date.now()}`,
      body: "Test body content",
    });
    expect(typeof result).toBe("boolean");
    console.log(`createNote result: ${result}`);
  }, 20000);

  it("returns false for empty title", async () => {
    const result = await notesModule.createNote({ title: "", body: "body" });
    expect(result).toBe(false);
  }, 5000);
});

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

describe("reminders_list_lists / listLists", () => {
  it("returns array of ReminderList objects", async () => {
    const lists = await remindersModule.listLists();
    expect(Array.isArray(lists)).toBe(true);
    for (const l of lists) {
      expect(typeof l.id).toBe("string");
      expect(typeof l.name).toBe("string");
    }
    console.log(`Found ${lists.length} reminder lists`);
  }, 15000);
});

describe("reminders_list / listReminders", () => {
  it("returns array of Reminder objects with correct shape", async () => {
    const reminders = await remindersModule.listReminders({});
    expect(Array.isArray(reminders)).toBe(true);
    for (const r of reminders) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.name).toBe("string");
      expect(typeof r.body).toBe("string");
      expect(typeof r.completed).toBe("boolean");
      expect(typeof r.listName).toBe("string");
      expect(typeof r.priority).toBe("number");
    }
    console.log(`listReminders returned ${reminders.length} reminders`);
  }, 60000);
});

describe("reminders_search / searchReminders", () => {
  it("returns array for any query", async () => {
    const results = await remindersModule.searchReminders({ query: "the" });
    expect(Array.isArray(results)).toBe(true);
  }, 60000);

  it("returns empty array for impossible query", async () => {
    const results = await remindersModule.searchReminders({ query: "ZzZzImpossibleQuery99991" });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  }, 30000);
});

describe("reminders_create / createReminder", () => {
  it("returns boolean", async () => {
    const result = await remindersModule.createReminder({
      name: `MCP Test Reminder ${Date.now()}`,
    });
    expect(typeof result).toBe("boolean");
    console.log(`createReminder result: ${result}`);
  }, 20000);

  it("returns false for empty name", async () => {
    const result = await remindersModule.createReminder({ name: "" });
    expect(result).toBe(false);
  }, 5000);
});

describe("reminders_complete / completeReminder", () => {
  it("returns false for non-existent id", async () => {
    const result = await remindersModule.completeReminder("fake-id-that-does-not-exist-99999");
    expect(result).toBe(false);
  }, 90000);
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

describe("messages_send / sendMessage", () => {
  it("returns boolean", async () => {
    const result = await messageModule.sendMessage("+10000000000", "MCP test");
    expect(typeof result).toBe("boolean");
    console.log(`sendMessage result: ${result}`);
  }, 20000);
});

describe("messages_unread / getUnreadMessages", () => {
  it("returns array of Message objects with correct shape", async () => {
    const messages = await messageModule.getUnreadMessages(5);
    expect(Array.isArray(messages)).toBe(true);
    for (const m of messages) {
      expect(typeof m.content).toBe("string");
      expect(typeof m.date).toBe("string");
      expect(typeof m.sender).toBe("string");
      expect(typeof m.is_from_me).toBe("boolean");
    }
    console.log(`Found ${messages.length} unread messages`);
  }, 20000);
});

describe("messages_read / readMessages", () => {
  it("returns array for any phone number", async () => {
    const messages = await messageModule.readMessages("+10000000000", 5);
    expect(Array.isArray(messages)).toBe(true);
  }, 20000);
});
