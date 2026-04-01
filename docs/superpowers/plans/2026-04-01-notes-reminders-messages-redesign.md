# Notes, Reminders & Messages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three monolithic operation-based tools (`notes`, `reminders`, `messages`) with 13 granular flat tools, rewriting all three utility files using the text-delimited AppleScript pattern.

**Architecture:** Each utility file is rewritten in-place using `|||ITEM|||`/`|||` text-delimited AppleScript output — no AppleScript record objects. tools.ts gains 13 new flat Tool constants (replacing 3 old ones). index.ts gains 13 flat case handlers (replacing 3 monolithic blocks and 3 type guard functions).

**Tech Stack:** Bun, TypeScript (ESM), run-applescript, sqlite3 (for messages reads), node:fs (for notes temp file)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `tests/integration/notes-reminders-messages.test.ts` | Create | Integration tests for all 13 new tools |
| `utils/notes.ts` | Full rewrite | listFolders, listNotes, searchNotes, getNote, createNote |
| `utils/reminders.ts` | Full rewrite | listLists, listReminders, searchReminders, createReminder, completeReminder |
| `utils/message.ts` | Full rewrite | sendMessage (boolean return + escapeAS), readMessages, getUnreadMessages; remove scheduleMessage + retry infra |
| `tools.ts` | Modify | Remove NOTES_TOOL, MESSAGES_TOOL, REMINDERS_TOOL; add 13 new flat constants |
| `index.ts` | Modify | Remove case "notes", "messages", "reminders" + 3 type guards; add 13 flat handlers |

---

### Task 1: Write integration tests

**Files:**
- Create: `tests/integration/notes-reminders-messages.test.ts`

These tests define the new API contracts. They will partially fail against the old modules — that is expected and is the TDD signal. Run them at the end of each rewrite task to verify.

- [ ] **Step 1: Create the test file**

```typescript
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
  }, 20000);

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
  }, 20000);
});

describe("reminders_search / searchReminders", () => {
  it("returns array for any query", async () => {
    const results = await remindersModule.searchReminders({ query: "the" });
    expect(Array.isArray(results)).toBe(true);
  }, 20000);

  it("returns empty array for impossible query", async () => {
    const results = await remindersModule.searchReminders({ query: "ZzZzImpossibleQuery99991" });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  }, 20000);
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
  }, 30000);
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

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
```

- [ ] **Step 2: Run tests to confirm initial state**

```bash
bun test tests/integration/notes-reminders-messages.test.ts 2>&1 | tail -5
```

Expected: Tests for `listFolders`, `listNotes`, `searchNotes`, `getNote`, `createNote` will fail (old module exports `getAllNotes`, `findNote`, etc. — not the new API). Tests for `remindersModule.listLists()`, `completeReminder()` etc. will fail similarly. Message tests may pass since the exports match. That's expected — it's the TDD signal.

- [ ] **Step 3: Commit the test file**

```bash
git add tests/integration/notes-reminders-messages.test.ts
git commit -m "test: add integration tests for notes/reminders/messages redesign (failing)"
```

---

### Task 2: Rewrite utils/notes.ts

**Files:**
- Modify: `utils/notes.ts` (full rewrite)

- [ ] **Step 1: Replace the entire file**

```typescript
// utils/notes.ts
import { runAppleScript } from "run-applescript";
import { writeFileSync, unlinkSync } from "node:fs";
import { escapeAppleScriptString as escapeAS } from "./applescript-utils.js";

export interface Note {
  name: string;
  folder: string;
  body: string;
}

export interface NoteFolder {
  name: string;
}

const PREVIEW_LENGTH = 200;

export async function listFolders(): Promise<NoteFolder[]> {
  const script = `tell application "Notes"
  set outputText to ""
  repeat with f in folders
    set fname to name of f
    if outputText is not "" then set outputText to outputText & "|||ITEM|||"
    set outputText to outputText & fname
  end repeat
  return outputText
end tell`;
  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return [];
    return raw.split("|||ITEM|||").map(name => ({ name: name.trim() }));
  } catch (error) {
    console.error("listFolders error:", error);
    return [];
  }
}

export async function listNotes(params: {
  folder?: string;
  limit?: number;
}): Promise<Note[]> {
  const { folder, limit = 50 } = params;
  const folderClause = folder
    ? `set noteSource to notes of folder "${escapeAS(folder)}"`
    : `set noteSource to notes`;

  const script = `tell application "Notes"
  try
    ${folderClause}
    set outputText to ""
    set nCount to 0
    repeat with n in noteSource
      if nCount >= ${limit} then exit repeat
      try
        set noteName to name of n
        set folderName to name of container of n
        set noteBody to plaintext of n
        if (length of noteBody) > ${PREVIEW_LENGTH} then
          set noteBody to (characters 1 thru ${PREVIEW_LENGTH} of noteBody) as string
          set noteBody to noteBody & "..."
        end if
        if nCount > 0 then set outputText to outputText & "|||ITEM|||"
        set outputText to outputText & noteName & "|||" & folderName & "|||" & noteBody
        set nCount to nCount + 1
      end try
    end repeat
    return outputText
  on error errMsg
    return "error:" & errMsg
  end try
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim() || raw.startsWith("error:")) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 3) return [];
      return [{ name: parts[0], folder: parts[1], body: parts.slice(2).join("|||") }];
    });
  } catch (error) {
    console.error("listNotes error:", error);
    return [];
  }
}

export async function searchNotes(params: {
  query: string;
  folder?: string;
  limit?: number;
}): Promise<Note[]> {
  const { query, folder, limit = 50 } = params;
  if (!query) return [];
  const safeQuery = escapeAS(query);
  const folderClause = folder
    ? `set noteSource to notes of folder "${escapeAS(folder)}"`
    : `set noteSource to notes`;

  const script = `tell application "Notes"
  try
    ${folderClause}
    set outputText to ""
    set nCount to 0
    repeat with n in noteSource
      if nCount >= ${limit} then exit repeat
      try
        set noteName to name of n
        set noteBody to plaintext of n
        if (noteName contains "${safeQuery}") or (noteBody contains "${safeQuery}") then
          set folderName to name of container of n
          set preview to noteBody
          if (length of preview) > ${PREVIEW_LENGTH} then
            set preview to (characters 1 thru ${PREVIEW_LENGTH} of preview) as string
            set preview to preview & "..."
          end if
          if nCount > 0 then set outputText to outputText & "|||ITEM|||"
          set outputText to outputText & noteName & "|||" & folderName & "|||" & preview
          set nCount to nCount + 1
        end if
      end try
    end repeat
    return outputText
  on error errMsg
    return "error:" & errMsg
  end try
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim() || raw.startsWith("error:")) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 3) return [];
      return [{ name: parts[0], folder: parts[1], body: parts.slice(2).join("|||") }];
    });
  } catch (error) {
    console.error("searchNotes error:", error);
    return [];
  }
}

export async function getNote(params: {
  name: string;
  folder?: string;
}): Promise<Note | null> {
  const { name, folder } = params;
  if (!name) return null;
  const safeName = escapeAS(name);
  const folderClause = folder
    ? `set noteSource to notes of folder "${escapeAS(folder)}"`
    : `set noteSource to notes`;

  const script = `tell application "Notes"
  try
    ${folderClause}
    repeat with n in noteSource
      try
        if name of n is "${safeName}" then
          set folderName to name of container of n
          set noteBody to plaintext of n
          return "${safeName}" & "|||" & folderName & "|||" & noteBody
        end if
      end try
    end repeat
    return ""
  on error
    return ""
  end try
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return null;
    const parts = raw.split("|||");
    if (parts.length < 3) return null;
    return { name: parts[0], folder: parts[1], body: parts.slice(2).join("|||") };
  } catch (error) {
    console.error("getNote error:", error);
    return null;
  }
}

export async function createNote(params: {
  title: string;
  body: string;
  folder?: string;
}): Promise<boolean> {
  const { title, body, folder = "Notes" } = params;
  if (!title) return false;

  const escapedTitle = escapeAS(title);
  const escapedFolder = escapeAS(folder);
  const tmpFile = `/tmp/note-content-${Date.now()}.txt`;

  try {
    writeFileSync(tmpFile, body, "utf8");

    const script = `tell application "Notes"
  try
    set targetFolder to null
    repeat with f in folders
      if name of f is "${escapedFolder}" then
        set targetFolder to f
        exit repeat
      end if
    end repeat
    if targetFolder is null then
      set targetFolder to (make new folder with properties {name:"${escapedFolder}"})
    end if
    set noteContent to read file POSIX file "${tmpFile}" as «class utf8»
    make new note at targetFolder with properties {name:"${escapedTitle}", body:noteContent}
    return "true"
  on error errMsg
    return "false"
  end try
end tell`;

    const result = await runAppleScript(script);
    return result.trim() === "true";
  } catch (error) {
    console.error("createNote error:", error);
    return false;
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

export default { listFolders, listNotes, searchNotes, getNote, createNote };
```

- [ ] **Step 2: Run notes tests**

```bash
bun test tests/integration/notes-reminders-messages.test.ts --testNamePattern "notes" 2>&1
```

Expected: All notes describe blocks pass (`notes_list_folders`, `notes_list`, `notes_search`, `notes_get`, `notes_create`). Reminders and messages tests are not run.

- [ ] **Step 3: Commit**

```bash
git add utils/notes.ts
git commit -m "feat: rewrite utils/notes.ts with text-delimited AppleScript pattern"
```

---

### Task 3: Rewrite utils/reminders.ts

**Files:**
- Modify: `utils/reminders.ts` (full rewrite)

- [ ] **Step 1: Replace the entire file**

```typescript
// utils/reminders.ts
import { runAppleScript } from "run-applescript";
import { escapeAppleScriptString as escapeAS, formatDateForAppleScript } from "./applescript-utils.js";

export interface Reminder {
  id: string;
  name: string;
  body: string;
  completed: boolean;
  dueDate: string | null;
  listName: string;
  priority: number;
}

export interface ReminderList {
  id: string;
  name: string;
}

// Skip lists larger than this when no explicit list filter is given.
const MAX_LIST_SIZE_FOR_AUTO_SCAN = 200;

function parseReminder(record: string): Reminder | null {
  const parts = record.split("|||");
  if (parts.length < 7) return null;
  return {
    id: parts[0].trim(),
    name: parts[1],
    body: parts[2],
    completed: parts[3] === "true",
    dueDate: parts[4] && parts[4] !== "missing value" ? parts[4] : null,
    listName: parts[5],
    priority: parseInt(parts[6]) || 0,
  };
}

export async function listLists(): Promise<ReminderList[]> {
  const script = `tell application "Reminders"
  set outputText to ""
  repeat with l in lists
    set lid to id of l
    set lname to name of l
    if outputText is not "" then set outputText to outputText & "|||ITEM|||"
    set outputText to outputText & lid & "|||" & lname
  end repeat
  return outputText
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 2) return [];
      return [{ id: parts[0].trim(), name: parts[1] }];
    });
  } catch (error) {
    console.error("listLists error:", error);
    return [];
  }
}

export async function listReminders(params: {
  list?: string;
  includeCompleted?: boolean;
  limit?: number;
}): Promise<Reminder[]> {
  const { list: listFilter, includeCompleted = false, limit = 50 } = params;

  const listIterationOpen = listFilter
    ? `repeat with l in (lists whose name is "${escapeAS(listFilter)}")`
    : `repeat with l in lists
      set listSize to count of reminders of l
      if listSize > ${MAX_LIST_SIZE_FOR_AUTO_SCAN} then
        -- skip large list
      else`;

  const listIterationClose = listFilter
    ? `end repeat`
    : `      end if
    end repeat`;

  const remindersFetch = includeCompleted
    ? `set remList to reminders of l`
    : `set remList to (reminders of l whose completed is false)`;

  const script = `tell application "Reminders"
  try
    set outputText to ""
    set rCount to 0
    ${listIterationOpen}
      set listName to name of l
      try
        ${remindersFetch}
        repeat with r in remList
          if rCount >= ${limit} then exit repeat
          try
            set rid to id of r
            set rname to name of r
            set rbody to ""
            try
              if body of r is not missing value then set rbody to body of r
            end try
            set rcompleted to (completed of r) as string
            set rdue to ""
            try
              if due date of r is not missing value then set rdue to (due date of r) as string
            end try
            set rpriority to (priority of r) as string
            if rCount > 0 then set outputText to outputText & "|||ITEM|||"
            set outputText to outputText & rid & "|||" & rname & "|||" & rbody & "|||" & rcompleted & "|||" & rdue & "|||" & listName & "|||" & rpriority
            set rCount to rCount + 1
          end try
        end repeat
      end try
      if rCount >= ${limit} then exit repeat
    ${listIterationClose}
    return outputText
  on error errMsg
    return "error:" & errMsg
  end try
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim() || raw.startsWith("error:")) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const r = parseReminder(item);
      return r ? [r] : [];
    });
  } catch (error) {
    console.error("listReminders error:", error);
    return [];
  }
}

export async function searchReminders(params: {
  query: string;
  list?: string;
  limit?: number;
}): Promise<Reminder[]> {
  const { query, list: listFilter, limit = 50 } = params;
  if (!query) return [];
  const safeQuery = escapeAS(query);

  const listIterationOpen = listFilter
    ? `repeat with l in (lists whose name is "${escapeAS(listFilter)}")`
    : `repeat with l in lists
      set listSize to count of reminders of l
      if listSize > ${MAX_LIST_SIZE_FOR_AUTO_SCAN} then
        -- skip large list
      else`;

  const listIterationClose = listFilter
    ? `end repeat`
    : `      end if
    end repeat`;

  const script = `tell application "Reminders"
  try
    set outputText to ""
    set rCount to 0
    ${listIterationOpen}
      set listName to name of l
      try
        set incompleteReminders to (reminders of l whose completed is false)
        repeat with r in incompleteReminders
          if rCount >= ${limit} then exit repeat
          try
            set rname to name of r
            set rbody to ""
            try
              if body of r is not missing value then set rbody to body of r
            end try
            if (rname contains "${safeQuery}") or (rbody contains "${safeQuery}") then
              set rid to id of r
              set rcompleted to (completed of r) as string
              set rdue to ""
              try
                if due date of r is not missing value then set rdue to (due date of r) as string
              end try
              set rpriority to (priority of r) as string
              if rCount > 0 then set outputText to outputText & "|||ITEM|||"
              set outputText to outputText & rid & "|||" & rname & "|||" & rbody & "|||" & rcompleted & "|||" & rdue & "|||" & listName & "|||" & rpriority
              set rCount to rCount + 1
            end if
          end try
        end repeat
      end try
      if rCount >= ${limit} then exit repeat
    ${listIterationClose}
    return outputText
  on error errMsg
    return "error:" & errMsg
  end try
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim() || raw.startsWith("error:")) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const r = parseReminder(item);
      return r ? [r] : [];
    });
  } catch (error) {
    console.error("searchReminders error:", error);
    return [];
  }
}

export async function createReminder(params: {
  name: string;
  list?: string;
  notes?: string;
  dueDate?: string;
}): Promise<boolean> {
  const { name, list, notes, dueDate } = params;
  if (!name) return false;

  const safeName = escapeAS(name);
  const listClause = list
    ? `set targetList to first item of (lists whose name is "${escapeAS(list)}")`
    : `set targetList to first item of lists`;

  const notesLine = notes ? `set body of newReminder to "${escapeAS(notes)}"` : "";

  let dueDateLine = "";
  if (dueDate) {
    const d = new Date(dueDate);
    if (!isNaN(d.getTime())) {
      dueDateLine = `set due date of newReminder to date "${escapeAS(formatDateForAppleScript(d))}"`;
    }
  }

  const script = `tell application "Reminders"
  try
    ${listClause}
    set newReminder to make new reminder at targetList with properties {name:"${safeName}"}
    ${notesLine}
    ${dueDateLine}
    return "true"
  on error errMsg
    return "false"
  end try
end tell`;

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "true";
  } catch (error) {
    console.error("createReminder error:", error);
    return false;
  }
}

export async function completeReminder(id: string): Promise<boolean> {
  if (!id) return false;
  const safeId = escapeAS(id);

  const script = `tell application "Reminders"
  try
    repeat with l in lists
      try
        set matches to (reminders of l whose id is "${safeId}")
        if (count of matches) > 0 then
          set completed of (item 1 of matches) to true
          return "true"
        end if
      end try
    end repeat
    return "false"
  on error
    return "false"
  end try
end tell`;

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "true";
  } catch (error) {
    console.error("completeReminder error:", error);
    return false;
  }
}

export default { listLists, listReminders, searchReminders, createReminder, completeReminder };
```

- [ ] **Step 2: Run reminders tests**

```bash
bun test tests/integration/notes-reminders-messages.test.ts --testNamePattern "reminders" 2>&1
```

Expected: All reminders describe blocks pass.

- [ ] **Step 3: Commit**

```bash
git add utils/reminders.ts
git commit -m "feat: rewrite utils/reminders.ts with text-delimited AppleScript pattern"
```

---

### Task 4: Rewrite utils/message.ts

**Files:**
- Modify: `utils/message.ts` (full rewrite)

Changes: `sendMessage` now returns `boolean` and uses `escapeAS`. `readMessages`/`getUnreadMessages` keep SQLite approach but drop retry wrappers. Remove `scheduleMessage`, `retryOperation`, `sleep`, `readMessagesAppleScript`, `getUnreadMessagesAppleScript`, `requestMessagesAccess`.

- [ ] **Step 1: Replace the entire file**

```typescript
// utils/message.ts
import { runAppleScript } from "run-applescript";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { normalizePhoneNumber, decodeAttributedBody } from "./phone-utils.js";
import { escapeAppleScriptString as escapeAS } from "./applescript-utils.js";

function runSqlite(dbPath: string, query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("sqlite3", ["-json", dbPath, query]);
    child.stdout.on("data", (d: Buffer) => { stdout += d; });
    child.stderr.on("data", (d: Buffer) => { stderr += d; });
    child.on("close", (code: number | null) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`sqlite3 exited with code ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout);
      }
    });
    child.on("error", reject);
  });
}

const MAX_MESSAGES = 50;

export interface Message {
  content: string;
  date: string;
  sender: string;
  is_from_me: boolean;
  attachments?: string[];
  url?: string;
}

async function checkMessagesDBAccess(): Promise<boolean> {
  try {
    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    await access(dbPath);
    await runSqlite(dbPath, "SELECT 1;");
    return true;
  } catch {
    return false;
  }
}

async function getAttachmentPaths(messageId: number): Promise<string[]> {
  try {
    const query = `
      SELECT filename FROM attachment
      INNER JOIN message_attachment_join
        ON attachment.ROWID = message_attachment_join.attachment_id
      WHERE message_attachment_join.message_id = ${messageId}
    `;
    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    const stdout = await runSqlite(dbPath, query);
    if (!stdout.trim()) return [];
    const attachments = JSON.parse(stdout) as { filename: string }[];
    return attachments.map(a => a.filename).filter(Boolean);
  } catch {
    return [];
  }
}

type RawMessage = {
  message_id: number;
  content: string | null;
  date: string;
  sender: string;
  is_from_me: number;
  is_audio_message: number;
  cache_has_attachments: number;
  subject: string | null;
  content_type: number;
};

async function processRawMessages(rows: RawMessage[]): Promise<Message[]> {
  return Promise.all(
    rows
      .filter(msg => msg.content !== null || msg.cache_has_attachments === 1)
      .map(async msg => {
        let content = msg.content || "";
        let url: string | undefined;

        if (msg.content_type === 1) {
          const decoded = decodeAttributedBody(content);
          content = decoded.text;
          url = decoded.url;
        } else {
          const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) url = urlMatch[1];
        }

        let attachments: string[] = [];
        if (msg.cache_has_attachments) {
          attachments = await getAttachmentPaths(msg.message_id);
        }

        if (msg.subject) content = `Subject: ${msg.subject}\n${content}`;

        const result: Message = {
          content: content || "[No text content]",
          date: new Date(msg.date).toISOString(),
          sender: msg.sender,
          is_from_me: Boolean(msg.is_from_me),
        };

        if (attachments.length > 0) {
          result.attachments = attachments;
          result.content += `\n[Attachments: ${attachments.length}]`;
        }
        if (url) {
          result.url = url;
          result.content += `\n[URL: ${url}]`;
        }

        return result;
      })
  );
}

export async function sendMessage(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const escapedMessage = escapeAS(message);
    const escapedPhone = escapeAS(phoneNumber);
    await runAppleScript(`tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "${escapedPhone}"
  send "${escapedMessage}" to targetBuddy
end tell`);
    return true;
  } catch (error) {
    console.error("sendMessage error:", error);
    return false;
  }
}

export async function readMessages(phoneNumber: string, limit = 10): Promise<Message[]> {
  try {
    const hasAccess = await checkMessagesDBAccess();
    if (!hasAccess) {
      console.error("Messages database not accessible. Grant Full Disk Access to your terminal.");
      return [];
    }

    const maxLimit = Math.min(limit, MAX_MESSAGES);
    const phoneFormats = normalizePhoneNumber(phoneNumber);
    const phoneList = phoneFormats.map(p => `'${p.replace(/'/g, "''")}'`).join(",");

    const query = `
      SELECT
        m.ROWID as message_id,
        CASE
          WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
          WHEN m.attributedBody IS NOT NULL THEN hex(m.attributedBody)
          ELSE NULL
        END as content,
        datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
        h.id as sender,
        m.is_from_me,
        m.is_audio_message,
        m.cache_has_attachments,
        m.subject,
        CASE
          WHEN m.text IS NOT NULL AND m.text != '' THEN 0
          WHEN m.attributedBody IS NOT NULL THEN 1
          ELSE 2
        END as content_type
      FROM message m
      INNER JOIN handle h ON h.ROWID = m.handle_id
      WHERE h.id IN (${phoneList})
        AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL OR m.cache_has_attachments = 1)
        AND m.is_from_me IS NOT NULL
        AND m.item_type = 0
        AND m.is_audio_message = 0
      ORDER BY m.date DESC
      LIMIT ${maxLimit}
    `;

    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    const stdout = await runSqlite(dbPath, query);
    if (!stdout.trim()) return [];
    const rows = JSON.parse(stdout) as RawMessage[];
    return processRawMessages(rows);
  } catch (error) {
    console.error("readMessages error:", error);
    return [];
  }
}

export async function getUnreadMessages(limit = 10): Promise<Message[]> {
  try {
    const hasAccess = await checkMessagesDBAccess();
    if (!hasAccess) {
      console.error("Messages database not accessible. Grant Full Disk Access to your terminal.");
      return [];
    }

    const maxLimit = Math.min(limit, MAX_MESSAGES);

    const query = `
      SELECT
        m.ROWID as message_id,
        CASE
          WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
          WHEN m.attributedBody IS NOT NULL THEN hex(m.attributedBody)
          ELSE NULL
        END as content,
        datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
        h.id as sender,
        m.is_from_me,
        m.is_audio_message,
        m.cache_has_attachments,
        m.subject,
        CASE
          WHEN m.text IS NOT NULL AND m.text != '' THEN 0
          WHEN m.attributedBody IS NOT NULL THEN 1
          ELSE 2
        END as content_type
      FROM message m
      INNER JOIN handle h ON h.ROWID = m.handle_id
      WHERE m.is_from_me = 0
        AND m.is_read = 0
        AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL OR m.cache_has_attachments = 1)
        AND m.is_audio_message = 0
        AND m.item_type = 0
      ORDER BY m.date DESC
      LIMIT ${maxLimit}
    `;

    const dbPath = `${process.env.HOME}/Library/Messages/chat.db`;
    const stdout = await runSqlite(dbPath, query);
    if (!stdout.trim()) return [];
    const rows = JSON.parse(stdout) as RawMessage[];
    return processRawMessages(rows);
  } catch (error) {
    console.error("getUnreadMessages error:", error);
    return [];
  }
}

export default { sendMessage, readMessages, getUnreadMessages };
```

- [ ] **Step 2: Run messages tests**

```bash
bun test tests/integration/notes-reminders-messages.test.ts --testNamePattern "messages" 2>&1
```

Expected: Both messages describe blocks pass.

- [ ] **Step 3: Run all three in the test file together**

```bash
bun test tests/integration/notes-reminders-messages.test.ts 2>&1 | tail -5
```

Expected: All tests pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add utils/message.ts
git commit -m "feat: rewrite utils/message.ts — boolean sendMessage, remove scheduleMessage/retry"
```

---

### Task 5: Update tools.ts

**Files:**
- Modify: `tools.ts`

Remove `NOTES_TOOL` (lines 17–47), `MESSAGES_TOOL` (lines 49–79), `REMINDERS_TOOL` (lines 81–127). Add 13 new flat constants in their place. Update the tools array.

- [ ] **Step 1: Replace the three old constants (lines 17–127) with 13 new ones**

Find this block at the top of `tools.ts` (after `CONTACTS_TOOL` closes at line 15) and before `CALENDAR_LIST_TOOL`:

```typescript
const NOTES_TOOL: Tool = {
  name: "notes", 
  // ... (entire block through closing };)
```
...through...
```typescript
  };
  

const CALENDAR_LIST_TOOL: Tool = {
```

Replace with:

```typescript
const NOTES_LIST_TOOL: Tool = {
  name: "notes_list",
  description: "List notes in Apple Notes, optionally filtered by folder",
  inputSchema: {
    type: "object",
    properties: {
      folder: { type: "string", description: "Folder name to filter by" },
      limit:  { type: "number", description: "Max results (default 50)" },
    },
  },
};

const NOTES_SEARCH_TOOL: Tool = {
  name: "notes_search",
  description: "Search notes by title or body text",
  inputSchema: {
    type: "object",
    properties: {
      query:  { type: "string", description: "Text to search for in note title or body" },
      folder: { type: "string", description: "Folder name to filter by" },
      limit:  { type: "number", description: "Max results (default 50)" },
    },
    required: ["query"],
  },
};

const NOTES_GET_TOOL: Tool = {
  name: "notes_get",
  description: "Get full content of a note by name",
  inputSchema: {
    type: "object",
    properties: {
      name:   { type: "string", description: "Note name (title)" },
      folder: { type: "string", description: "Folder name to disambiguate notes with the same title" },
    },
    required: ["name"],
  },
};

const NOTES_CREATE_TOOL: Tool = {
  name: "notes_create",
  description: "Create a new note in Apple Notes",
  inputSchema: {
    type: "object",
    properties: {
      title:  { type: "string", description: "Note title" },
      body:   { type: "string", description: "Note body content" },
      folder: { type: "string", description: "Folder name (default: Notes)" },
    },
    required: ["title", "body"],
  },
};

const NOTES_LIST_FOLDERS_TOOL: Tool = {
  name: "notes_list_folders",
  description: "List all folders in Apple Notes",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const REMINDERS_LIST_LISTS_TOOL: Tool = {
  name: "reminders_list_lists",
  description: "List all reminder lists in Apple Reminders",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const REMINDERS_LIST_TOOL: Tool = {
  name: "reminders_list",
  description: "List reminders, optionally filtered by list",
  inputSchema: {
    type: "object",
    properties: {
      list:             { type: "string", description: "List name to filter by" },
      includeCompleted: { type: "boolean", description: "Include completed reminders (default false)" },
      limit:            { type: "number", description: "Max results (default 50)" },
    },
  },
};

const REMINDERS_SEARCH_TOOL: Tool = {
  name: "reminders_search",
  description: "Search incomplete reminders by name or notes text",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for" },
      list:  { type: "string", description: "List name to filter by" },
      limit: { type: "number", description: "Max results (default 50)" },
    },
    required: ["query"],
  },
};

const REMINDERS_CREATE_TOOL: Tool = {
  name: "reminders_create",
  description: "Create a new reminder",
  inputSchema: {
    type: "object",
    properties: {
      name:    { type: "string", description: "Reminder name" },
      list:    { type: "string", description: "List name (uses first available if omitted)" },
      notes:   { type: "string", description: "Reminder notes/body" },
      dueDate: { type: "string", description: "Due date in ISO format" },
    },
    required: ["name"],
  },
};

const REMINDERS_COMPLETE_TOOL: Tool = {
  name: "reminders_complete",
  description: "Mark a reminder as completed by its ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Reminder ID (from reminders_list or reminders_search)" },
    },
    required: ["id"],
  },
};

const MESSAGES_SEND_TOOL: Tool = {
  name: "messages_send",
  description: "Send an iMessage or SMS via Apple Messages",
  inputSchema: {
    type: "object",
    properties: {
      phoneNumber: { type: "string", description: "Phone number or email address to send to" },
      message:     { type: "string", description: "Message text to send" },
    },
    required: ["phoneNumber", "message"],
  },
};

const MESSAGES_READ_TOOL: Tool = {
  name: "messages_read",
  description: "Read recent messages from a contact by phone number",
  inputSchema: {
    type: "object",
    properties: {
      phoneNumber: { type: "string", description: "Phone number or email of the contact" },
      limit:       { type: "number", description: "Max messages to return (default 10)" },
    },
    required: ["phoneNumber"],
  },
};

const MESSAGES_UNREAD_TOOL: Tool = {
  name: "messages_unread",
  description: "Get unread messages from Apple Messages",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max messages to return (default 10)" },
    },
  },
};

```

- [ ] **Step 2: Update the tools array**

Find:
```typescript
const tools = [
  CONTACTS_TOOL, NOTES_TOOL, MESSAGES_TOOL, REMINDERS_TOOL, MAPS_TOOL,
```

Replace with:
```typescript
const tools = [
  CONTACTS_TOOL,
  // Notes tools (5)
  NOTES_LIST_TOOL, NOTES_SEARCH_TOOL, NOTES_GET_TOOL, NOTES_CREATE_TOOL, NOTES_LIST_FOLDERS_TOOL,
  // Reminders tools (5)
  REMINDERS_LIST_LISTS_TOOL, REMINDERS_LIST_TOOL, REMINDERS_SEARCH_TOOL,
  REMINDERS_CREATE_TOOL, REMINDERS_COMPLETE_TOOL,
  // Messages tools (3)
  MESSAGES_SEND_TOOL, MESSAGES_READ_TOOL, MESSAGES_UNREAD_TOOL,
  MAPS_TOOL,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
bun run index.ts 2>&1 | head -5
```

Expected: `Starting apple-mcp server...` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add tools.ts
git commit -m "feat: add 13 notes/reminders/messages tool constants, remove 3 old monolithic ones"
```

---

### Task 6: Update index.ts

**Files:**
- Modify: `index.ts`

Remove three monolithic case blocks and three type guard functions. Add 13 flat case handlers.

- [ ] **Step 1: Remove `case "notes":` block**

Find (line ~275):
```typescript
				case "notes": {
					if (!isNotesArgs(args)) {
						throw new Error("Invalid arguments for notes tool");
					}
          // ... entire block through closing `}`
				}

				case "messages": {
```

Replace with just:
```typescript
				case "messages": {
```

(The entire `case "notes":` block from its opening through its closing `}` is deleted.)

- [ ] **Step 2: Remove `case "messages":` block**

Find (line ~368):
```typescript
				case "messages": {
					if (!isMessagesArgs(args)) {
						throw new Error("Invalid arguments for messages tool");
					}
          // ... entire block through closing `}`
				}

				case "mail_search": {
```

Replace with just:
```typescript
				case "mail_search": {
```

- [ ] **Step 3: Remove `case "reminders":` block**

Find (line ~865):
```typescript
				case "reminders": {
					if (!isRemindersArgs(args)) {
						throw new Error("Invalid arguments for reminders tool");
					}
          // ... entire block through closing `}`
				}

				case "maps": {
```

Replace with just:
```typescript
				case "maps": {
```

- [ ] **Step 4: Remove the three type guard functions**

Find and delete the entire `isNotesArgs` function (starts `function isNotesArgs`, ends at its closing `}`).

Find and delete the entire `isMessagesArgs` function.

Find and delete the entire `isRemindersArgs` function.

- [ ] **Step 5: Add 13 flat handlers**

Find the line:
```typescript
				case "mail_search": {
```

Insert the following 13 case handlers immediately before it:

```typescript
				case "notes_list": {
					const notesModule = await loadModule("notes");
					const { folder, limit } = args as { folder?: string; limit?: number };
					const notes = await notesModule.listNotes({ folder, limit });
					return {
						content: [{ type: "text", text: notes.length ? JSON.stringify(notes, null, 2) : "No notes found." }],
						isError: false,
					};
				}

				case "notes_search": {
					const notesModule = await loadModule("notes");
					const { query, folder, limit } = args as { query: string; folder?: string; limit?: number };
					if (!query) throw new Error("query is required");
					const notes = await notesModule.searchNotes({ query, folder, limit });
					return {
						content: [{ type: "text", text: notes.length ? JSON.stringify(notes, null, 2) : `No notes found matching "${query}".` }],
						isError: false,
					};
				}

				case "notes_get": {
					const notesModule = await loadModule("notes");
					const { name, folder } = args as { name: string; folder?: string };
					if (!name) throw new Error("name is required");
					const note = await notesModule.getNote({ name, folder });
					return {
						content: [{ type: "text", text: note ? JSON.stringify(note, null, 2) : `Note "${name}" not found.` }],
						isError: false,
					};
				}

				case "notes_create": {
					const notesModule = await loadModule("notes");
					const { title, body, folder } = args as { title: string; body: string; folder?: string };
					if (!title) throw new Error("title is required");
					const ok = await notesModule.createNote({ title, body: body ?? "", folder });
					return {
						content: [{ type: "text", text: ok ? `Note "${title}" created.` : "Failed to create note." }],
						isError: !ok,
					};
				}

				case "notes_list_folders": {
					const notesModule = await loadModule("notes");
					const folders = await notesModule.listFolders();
					return {
						content: [{ type: "text", text: folders.length ? JSON.stringify(folders, null, 2) : "No folders found." }],
						isError: false,
					};
				}

				case "reminders_list_lists": {
					const remindersModule = await loadModule("reminders");
					const lists = await remindersModule.listLists();
					return {
						content: [{ type: "text", text: lists.length ? JSON.stringify(lists, null, 2) : "No reminder lists found." }],
						isError: false,
					};
				}

				case "reminders_list": {
					const remindersModule = await loadModule("reminders");
					const { list, includeCompleted, limit } = args as { list?: string; includeCompleted?: boolean; limit?: number };
					const reminders = await remindersModule.listReminders({ list, includeCompleted, limit });
					return {
						content: [{ type: "text", text: reminders.length ? JSON.stringify(reminders, null, 2) : "No reminders found." }],
						isError: false,
					};
				}

				case "reminders_search": {
					const remindersModule = await loadModule("reminders");
					const { query, list, limit } = args as { query: string; list?: string; limit?: number };
					if (!query) throw new Error("query is required");
					const reminders = await remindersModule.searchReminders({ query, list, limit });
					return {
						content: [{ type: "text", text: reminders.length ? JSON.stringify(reminders, null, 2) : `No reminders found matching "${query}".` }],
						isError: false,
					};
				}

				case "reminders_create": {
					const remindersModule = await loadModule("reminders");
					const { name, list, notes, dueDate } = args as { name: string; list?: string; notes?: string; dueDate?: string };
					if (!name) throw new Error("name is required");
					const ok = await remindersModule.createReminder({ name, list, notes, dueDate });
					return {
						content: [{ type: "text", text: ok ? `Reminder "${name}" created.` : "Failed to create reminder." }],
						isError: !ok,
					};
				}

				case "reminders_complete": {
					const remindersModule = await loadModule("reminders");
					const { id } = args as { id: string };
					if (!id) throw new Error("id is required");
					const ok = await remindersModule.completeReminder(id);
					return {
						content: [{ type: "text", text: ok ? "Reminder marked as completed." : "Failed to complete reminder (not found)." }],
						isError: !ok,
					};
				}

				case "messages_send": {
					const messageModule = await loadModule("message");
					const { phoneNumber, message } = args as { phoneNumber: string; message: string };
					if (!phoneNumber) throw new Error("phoneNumber is required");
					if (!message) throw new Error("message is required");
					const ok = await messageModule.sendMessage(phoneNumber, message);
					return {
						content: [{ type: "text", text: ok ? `Message sent to ${phoneNumber}.` : `Failed to send message to ${phoneNumber}.` }],
						isError: !ok,
					};
				}

				case "messages_read": {
					const messageModule = await loadModule("message");
					const { phoneNumber, limit } = args as { phoneNumber: string; limit?: number };
					if (!phoneNumber) throw new Error("phoneNumber is required");
					const messages = await messageModule.readMessages(phoneNumber, limit);
					return {
						content: [{ type: "text", text: messages.length ? JSON.stringify(messages, null, 2) : "No messages found." }],
						isError: false,
					};
				}

				case "messages_unread": {
					const messageModule = await loadModule("message");
					const { limit } = args as { limit?: number };
					const messages = await messageModule.getUnreadMessages(limit);
					const contactsModule = await loadModule("contacts");
					const enriched = await Promise.all(
						messages.map(async msg => {
							if (!msg.is_from_me) {
								const contactName = await contactsModule.findContactByPhone(msg.sender);
								return { ...msg, displayName: contactName || msg.sender };
							}
							return { ...msg, displayName: "Me" };
						})
					);
					return {
						content: [{ type: "text", text: enriched.length ? JSON.stringify(enriched, null, 2) : "No unread messages." }],
						isError: false,
					};
				}

```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
bun run index.ts 2>&1 | head -10
```

Expected: All modules load successfully, no errors.

- [ ] **Step 7: Commit**

```bash
git add index.ts
git commit -m "feat: replace monolithic notes/reminders/messages handlers with 13 flat case handlers"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all new integration tests**

```bash
bun test tests/integration/notes-reminders-messages.test.ts 2>&1
```

Expected: All tests pass, 0 fail.

- [ ] **Step 2: Run calendar tests to confirm no regression**

```bash
bun test tests/integration/calendar.test.ts 2>&1 | tail -5
```

Expected: 18 pass, 0 fail.

- [ ] **Step 3: Verify server lists all tools**

```bash
bun run index.ts 2>&1 | head -12
```

Expected: Server starts and all modules load (contacts, notes, message, mail, reminders, calendar, maps).

- [ ] **Step 4: Final commit if any cleanup needed, then done**

```bash
git log --oneline -8
```

Expected commit history (newest first):
```
feat: replace monolithic notes/reminders/messages handlers with 13 flat case handlers
feat: add 13 notes/reminders/messages tool constants, remove 3 old monolithic ones
feat: rewrite utils/message.ts — boolean sendMessage, remove scheduleMessage/retry
feat: rewrite utils/reminders.ts with text-delimited AppleScript pattern
feat: rewrite utils/notes.ts with text-delimited AppleScript pattern
test: add integration tests for notes/reminders/messages redesign (failing)
```
