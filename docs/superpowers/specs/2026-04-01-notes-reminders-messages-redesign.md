# Notes, Reminders & Messages Redesign

**Date:** 2026-04-01  
**Branch:** task/enhance  
**Status:** Approved

## Goal

Replace three monolithic operation-based tools (`notes`, `reminders`, `messages`) with 13 granular flat tools following the pattern established by the calendar and mail redesigns. Fix broken/stubbed utility implementations using the text-delimited AppleScript output pattern.

## Background

- `notes` tool: core functions work but use fragile AppleScript record objects; folder functions broken
- `reminders` tool: `getAllReminders`, `searchReminders`, `getRemindersFromListById` are stubs returning empty arrays with "too slow" comments; `createReminder` ignores `list`, `notes`, and `dueDate` params
- `messages` tool: mostly works (SQLite for reads, AppleScript for sends); needs restructuring and cleanup

## Architecture

**Pattern:** All AppleScript output uses text-delimited strings (`|||ITEM|||` between records, `|||` between fields within a record). No AppleScript record objects. No `require("fs")` (CommonJS) in ESM files.

**Module structure:** Single file per tool — no core/actions/manage split. Each utility file is rewritten in-place:
- `utils/notes.ts`
- `utils/reminders.ts`
- `utils/message.ts`

**Shared utilities:** `escapeAppleScriptString` and `formatDateForAppleScript` from `applescript-utils.ts` used throughout.

## Types

```ts
// utils/notes.ts
interface Note {
  name: string;
  folder: string;
  body: string;        // preview (200 chars) in list/search; full in notes_get
}

interface NoteFolder {
  name: string;
}

// utils/reminders.ts
interface Reminder {
  id: string;
  name: string;
  body: string;
  completed: boolean;
  dueDate: string | null;   // ISO string or null
  listName: string;
  priority: number;         // 0=none, 1=low, 5=medium, 9=high
}

interface ReminderList {
  id: string;
  name: string;
}

// utils/message.ts (unchanged from current)
interface Message {
  content: string;
  date: string;
  sender: string;
  is_from_me: boolean;
  attachments?: string[];
  url?: string;
}
```

## Tools

### Notes — 5 tools

| Tool | Params | Returns |
|------|--------|---------|
| `notes_list` | `folder?`, `limit?` (default 50) | `Note[]` with 200-char body preview |
| `notes_search` | `query` (required), `folder?`, `limit?` | `Note[]` with 200-char body preview |
| `notes_get` | `name` (required), `folder?` | `Note` with full body, or null |
| `notes_create` | `title`, `body`, `folder?` (default "Notes") | `boolean` |
| `notes_list_folders` | — | `NoteFolder[]` |

### Reminders — 5 tools

| Tool | Params | Returns |
|------|--------|---------|
| `reminders_list_lists` | — | `ReminderList[]` |
| `reminders_list` | `list?`, `includeCompleted?`, `limit?` (default 50) | `Reminder[]` |
| `reminders_search` | `query` (required), `list?`, `limit?` | `Reminder[]` incomplete only |
| `reminders_create` | `name`, `list?`, `notes?`, `dueDate?` | `boolean` |
| `reminders_complete` | `id` (required) | `boolean` |

### Messages — 3 tools

| Tool | Params | Returns |
|------|--------|---------|
| `messages_send` | `phoneNumber`, `message` | `boolean` |
| `messages_read` | `phoneNumber`, `limit?` (default 10) | `Message[]` |
| `messages_unread` | `limit?` (default 10) | `Message[]` |

## Utility Rewrite Details

### utils/notes.ts

- `listNotes({ folder?, limit? })` — iterates `notes of application "Notes"`, optionally scoped to a folder. Returns text-delimited records: `name|||folder|||body_preview`.
- `searchNotes({ query, folder?, limit? })` — same iteration, filters where `name contains query or plaintext contains query` (case-sensitive in AppleScript; acceptable).
- `getNote({ name, folder? })` — finds note by exact name match, returns full `plaintext` with no truncation.
- `createNote({ title, body, folder? })` — writes body to a temp file (`/tmp/note-content-<ts>.txt`), reads it back in AppleScript to avoid string escaping limits. Returns `boolean`. Creates folder if it doesn't exist.
- `listFolders()` — iterates `folders of application "Notes"`, returns `name|||ITEM|||name...`.

No performance guard needed — Notes doesn't have the Calendar O(n) date-filter issue.

### utils/reminders.ts

- `listLists()` — iterates `lists`, returns text-delimited `id|||name`.
- `listReminders({ list?, includeCompleted?, limit? })` — when `list` is given, scopes to that list. When not given, applies a **size guard**: skip lists with more than 200 reminders to stay within time budget. Filters `completed is false` by default. Returns `id|||name|||body|||completed|||dueDate|||listName|||priority`.
- `searchReminders({ query, list?, limit? })` — same iteration + size guard, filters where `name contains query or body contains query`, incomplete only.
- `createReminder({ name, list?, notes?, dueDate? })` — finds named list or uses first available. Sets `body` (notes) and `due date` properties. Returns `boolean`.
- `completeReminder(id)` — finds reminder by `id` across all lists using `whose id is`, sets `completed to true`. Returns `boolean`.

**Date format for AppleScript:** `formatDateForAppleScript` from `applescript-utils` produces `"Month D, YYYY HH:MM:SS AM/PM"` which AppleScript's `date` coercion accepts.

**Priority mapping:** AppleScript uses integers 0/1/5/9 for none/low/medium/high.

### utils/message.ts

Changes from current:
- `sendMessage` — replace manual `replace(/\\/g, '\\\\')` escaping with `escapeAppleScriptString` from `applescript-utils`
- `readMessages` and `getUnreadMessages` — keep SQLite approach unchanged (it works)
- **Remove:** `scheduleMessage` (in-memory `setTimeout`, doesn't survive server restarts, no list/cancel), `readMessagesAppleScript`, `getUnreadMessagesAppleScript`, retry infrastructure (SQLite queries don't need retries)
- Export: `{ sendMessage, readMessages, getUnreadMessages }`

## tools.ts Changes

Remove `NOTES_TOOL`, `REMINDERS_TOOL`, `MESSAGES_TOOL`. Add 13 new flat constants:

```
NOTES_LIST_TOOL, NOTES_SEARCH_TOOL, NOTES_GET_TOOL,
NOTES_CREATE_TOOL, NOTES_LIST_FOLDERS_TOOL,

REMINDERS_LIST_LISTS_TOOL, REMINDERS_LIST_TOOL, REMINDERS_SEARCH_TOOL,
REMINDERS_CREATE_TOOL, REMINDERS_COMPLETE_TOOL,

MESSAGES_SEND_TOOL, MESSAGES_READ_TOOL, MESSAGES_UNREAD_TOOL
```

## index.ts Changes

Remove:
- `case "notes":` block and `isNotesArgs` type guard
- `case "reminders":` block and `isRemindersArgs` type guard  
- `case "messages":` block and `isMessagesArgs` type guard

Add 13 individual `case "notes_*":`, `case "reminders_*":`, `case "messages_*":` handlers using flat args destructuring and JSON output (same pattern as mail/calendar handlers).

## Error Handling

- All utility functions return `false` / `null` / `[]` on failure (no thrown errors surfaced to the tool layer)
- `console.error` for unexpected failures
- Validate required params before AppleScript execution (return `false` immediately for empty name/title/query)

## Testing

Integration test file: `tests/integration/notes-reminders-messages.test.ts`

**Notes tests:**
- `notes_list_folders` returns `NoteFolder[]` with string names
- `notes_list` returns `Note[]` with correct shape
- `notes_search` returns array (possibly empty) for any query
- `notes_search` returns empty for impossible query
- `notes_get` returns null for non-existent name
- `notes_create` returns boolean; false for empty title

**Reminders tests:**
- `reminders_list_lists` returns `ReminderList[]` with id and name
- `reminders_list` returns `Reminder[]` with correct shape
- `reminders_search` returns array for any query
- `reminders_search` returns empty for impossible query
- `reminders_create` returns boolean
- `reminders_create` returns false for empty name
- `reminders_complete` returns false for non-existent id

**Messages tests:**
- `messages_unread` returns `Message[]` with correct shape
- `messages_read` returns array for any phone number (possibly empty)
- `messages_send` — skipped in automated tests (would actually send a message)

## Implementation Order

1. Rewrite `utils/notes.ts` + integration tests
2. Rewrite `utils/reminders.ts` + integration tests
3. Rewrite `utils/message.ts` + integration tests
4. Update `tools.ts` — 13 new constants, remove 3 old
5. Update `index.ts` — 13 new handlers, remove 3 old + type guards
6. Final verification — run all integration tests
