# Calendar Tools Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken single `calendar` MCP tool with 10 real, granular `calendar_*` tools backed by working AppleScript implementations.

**Architecture:** Three domain modules (`calendar-core.ts`, `calendar-actions.ts`, `calendar-manage.ts`) are re-exported through a barrel `utils/calendar.ts`. `tools.ts` gets 10 focused tool constants and `index.ts` gets 10 direct `case` handlers, replacing the old nested-switch `case "calendar":` block.

**Tech Stack:** TypeScript/ESNext, Bun runtime, `run-applescript` package, Bun test framework (`bun:test`), AppleScript via macOS Calendar.app

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `utils/calendar-core.ts` | Create | Helpers, types, `listCalendars`, `listEvents`, `searchEvents`, `getEvent` |
| `utils/calendar-actions.ts` | Create | `createEvent`, `updateEvent`, `deleteEvent`, `openEvent` |
| `utils/calendar-manage.ts` | Create | `getFreeBusy`, `findAvailableSlots` |
| `utils/calendar.ts` | Replace | Barrel re-export (delete old broken implementation) |
| `tools.ts` | Modify | Remove `CALENDAR_TOOL`, add 10 `calendar_*` constants |
| `index.ts` | Modify | Remove `case "calendar":` + `isCalendarArgs`, add 10 `case "calendar_*":` handlers |
| `tests/integration/calendar.test.ts` | Create | Integration tests for all 10 tools |

---

## Task 1: Create `utils/calendar-core.ts` (read operations)

**Files:**
- Create: `utils/calendar-core.ts`
- Create: `tests/integration/calendar.test.ts`
- Modify: `utils/calendar.ts`

- [ ] **Step 1: Write failing tests for read operations**

Create `tests/integration/calendar.test.ts`:

```typescript
// tests/integration/calendar.test.ts
import { describe, it, expect } from "bun:test";
import calendarModule from "../../utils/calendar.js";

describe("calendar_list_calendars / listCalendars", () => {
  it("returns array of Calendar objects", async () => {
    const cals = await calendarModule.listCalendars();
    expect(Array.isArray(cals)).toBe(true);
    for (const c of cals) {
      expect(typeof c.name).toBe("string");
      expect(typeof c.writable).toBe("boolean");
    }
    console.log(`Found ${cals.length} calendars`);
  }, 15000);
});

describe("calendar_list / listEvents", () => {
  it("returns array with correct shape (no args)", async () => {
    const events = await calendarModule.listEvents({});
    expect(Array.isArray(events)).toBe(true);
    for (const e of events) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.title).toBe("string");
      expect(e.startDate instanceof Date).toBe(true);
      expect(e.endDate instanceof Date).toBe(true);
      expect(typeof e.calendarName).toBe("string");
      expect(typeof e.isAllDay).toBe("boolean");
    }
    console.log(`listEvents returned ${events.length} events`);
  }, 20000);

  it("respects limit param", async () => {
    const events = await calendarModule.listEvents({ limit: 2 });
    expect(events.length).toBeLessThanOrEqual(2);
  }, 20000);
});

describe("calendar_search / searchEvents", () => {
  it("returns array", async () => {
    const events = await calendarModule.searchEvents({ query: "meeting" });
    expect(Array.isArray(events)).toBe(true);
  }, 20000);

  it("returns empty array for impossible query", async () => {
    const events = await calendarModule.searchEvents({ query: "ZzZzImpossibleQuery99991" });
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);
  }, 20000);
});

describe("calendar_get / getEvent", () => {
  it("returns null for non-existent id", async () => {
    const result = await calendarModule.getEvent("fake-uid-that-does-not-exist-99999");
    expect(result).toBeNull();
  }, 15000);

  it("returns event with attendees array for real event if one exists", async () => {
    const events = await calendarModule.listEvents({ limit: 1 });
    if (events.length === 0) { console.log("No events available"); return; }
    const event = await calendarModule.getEvent(events[0].id);
    if (event) {
      expect(typeof event.id).toBe("string");
      expect(typeof event.title).toBe("string");
      expect(event.startDate instanceof Date).toBe(true);
      expect(Array.isArray(event.attendees)).toBe(true);
    }
  }, 20000);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/calendar.test.ts 2>&1 | head -30
```

Expected: FAIL — `calendarModule.listCalendars is not a function` (old barrel doesn't have these functions)

- [ ] **Step 3: Create `utils/calendar-core.ts`**

```typescript
// utils/calendar-core.ts
import { runAppleScript } from "run-applescript";
import { escapeAppleScriptString as escapeAS, formatDateForAppleScript } from "./applescript-utils.js";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const AS_DATE_STR = `((year of d) as string) & "-" & ((month of d as integer) as string) & "-" & ((day of d) as string) & "-" & ((hours of d) as string) & "-" & ((minutes of d) as string) & "-" & ((seconds of d) as string)`;

function parseASDate(s: string): Date {
  const parts = s.split("-").map(Number);
  if (parts.length === 6 && parts.every(n => !isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  calendarName: string;
  isAllDay: boolean;
  location?: string;
  notes?: string;
  url?: string;
  attendees?: string[];
}

export interface Calendar {
  name: string;
  color?: string;
  writable: boolean;
}

export interface BusyBlock {
  title: string;
  startDate: Date;
  endDate: Date;
  calendarName: string;
}

export interface AvailableSlot {
  startDate: Date;
  endDate: Date;
}

// ---------------------------------------------------------------------------
// Internal AppleScript snippets
// ---------------------------------------------------------------------------

// Reads all displayable fields from `evt` (with `cal` in scope) into named vars.
const READ_EVT_FIELDS = `
          set evtId to uid of evt
          set evtTitle to summary of evt
          set d to start date of evt
          set evtStart to ${AS_DATE_STR}
          set d to end date of evt
          set evtEnd to ${AS_DATE_STR}
          set evtCal to name of cal
          set evtAllDay to (allday event of evt) as string
          set evtLoc to ""
          try
            set evtLoc to location of evt
          end try
          set evtNotes to ""
          try
            set evtNotes to description of evt
          end try
          set evtUrl to ""
          try
            set evtUrl to (url of evt) as string
          end try
          set evtAtt to ""
          try
            repeat with att in attendees of evt
              set attName to display name of att
              set attEmail to ""
              try
                set attEmail to email of att
              end try
              if evtAtt is not "" then set evtAtt to evtAtt & ","
              if attEmail is not "" then
                set evtAtt to evtAtt & attName & " <" & attEmail & ">"
              else
                set evtAtt to evtAtt & attName
              end if
            end repeat
          end try`;

const EVT_RECORD = `evtId & "|||" & evtTitle & "|||" & evtStart & "|||" & evtEnd & "|||" & evtCal & "|||" & evtAllDay & "|||" & evtLoc & "|||" & evtNotes & "|||" & evtUrl & "|||" & evtAtt`;

function parseEvent(record: string): CalendarEvent | null {
  const parts = record.split("|||");
  if (parts.length < 6) return null;
  return {
    id: parts[0].trim(),
    title: parts[1],
    startDate: parseASDate(parts[2]),
    endDate: parseASDate(parts[3]),
    calendarName: parts[4],
    isAllDay: parts[5] === "true",
    location: parts[6] || undefined,
    notes: parts[7] || undefined,
    url: parts[8] || undefined,
    attendees: parts[9] ? parts[9].split(",").filter(Boolean) : [],
  };
}

// ---------------------------------------------------------------------------
// listCalendars
// ---------------------------------------------------------------------------

export async function listCalendars(): Promise<Calendar[]> {
  const script = `tell application "Calendar"
    set calList to {}
    repeat with cal in calendars
      set calName to name of cal
      set calColor to ""
      try
        set calColor to (color of cal) as string
      end try
      set calWritable to (writable of cal) as string
      set end of calList to calName & "|||" & calColor & "|||" & calWritable
    end repeat
    set AppleScript's text item delimiters to "|||ITEM|||"
    return calList as text
  end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 3) return [];
      return [{ name: parts[0], color: parts[1] || undefined, writable: parts[2] === "true" }];
    });
  } catch (error) {
    console.error("listCalendars error:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

export async function listEvents(params: {
  startDate?: string;
  endDate?: string;
  calendar?: string;
  limit?: number;
}): Promise<CalendarEvent[]> {
  const { limit = 50, calendar: calFilter } = params;

  const now = new Date();
  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(now.getDate() + 7);

  const start = params.startDate ? new Date(params.startDate) : now;
  const end = params.endDate ? new Date(params.endDate) : sevenDaysOut;

  const startStr = escapeAS(formatDateForAppleScript(start));
  const endStr = escapeAS(formatDateForAppleScript(end));
  const calIteration = calFilter
    ? `repeat with cal in (calendars whose name is "${escapeAS(calFilter)}")`
    : `repeat with cal in calendars`;

  const script = `tell application "Calendar"
  try
    set outputText to ""
    set evtCount to 0
    set startBound to date "${startStr}"
    set endBound to date "${endStr}"
    ${calIteration}
      set rangeEvents to (events of cal whose start date >= startBound and start date <= endBound)
      repeat with evt in rangeEvents
        if evtCount >= ${limit} then exit repeat
        try
          ${READ_EVT_FIELDS}
          if evtCount > 0 then set outputText to outputText & "|||ITEM|||"
          set outputText to outputText & ${EVT_RECORD}
          set evtCount to evtCount + 1
        end try
      end repeat
      if evtCount >= ${limit} then exit repeat
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
      const evt = parseEvent(item);
      return evt ? [evt] : [];
    });
  } catch (error) {
    console.error("listEvents error:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// searchEvents
// ---------------------------------------------------------------------------

export async function searchEvents(params: {
  query: string;
  startDate?: string;
  endDate?: string;
  calendar?: string;
  limit?: number;
}): Promise<CalendarEvent[]> {
  const { query, limit = 50, calendar: calFilter } = params;

  const now = new Date();
  const thirtyDaysOut = new Date(now);
  thirtyDaysOut.setDate(now.getDate() + 30);

  const start = params.startDate ? new Date(params.startDate) : now;
  const end = params.endDate ? new Date(params.endDate) : thirtyDaysOut;

  const startStr = escapeAS(formatDateForAppleScript(start));
  const endStr = escapeAS(formatDateForAppleScript(end));
  const safeQuery = escapeAS(query);
  const calIteration = calFilter
    ? `repeat with cal in (calendars whose name is "${escapeAS(calFilter)}")`
    : `repeat with cal in calendars`;

  const script = `tell application "Calendar"
  try
    set outputText to ""
    set evtCount to 0
    set startBound to date "${startStr}"
    set endBound to date "${endStr}"
    ${calIteration}
      set rangeEvents to (events of cal whose start date >= startBound and start date <= endBound)
      repeat with evt in rangeEvents
        if evtCount >= ${limit} then exit repeat
        try
          set peekTitle to summary of evt
          set peekNotes to ""
          try
            set peekNotes to description of evt
          end try
          if (peekTitle contains "${safeQuery}") or (peekNotes contains "${safeQuery}") then
            ${READ_EVT_FIELDS}
            if evtCount > 0 then set outputText to outputText & "|||ITEM|||"
            set outputText to outputText & ${EVT_RECORD}
            set evtCount to evtCount + 1
          end if
        end try
      end repeat
      if evtCount >= ${limit} then exit repeat
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
      const evt = parseEvent(item);
      return evt ? [evt] : [];
    });
  } catch (error) {
    console.error("searchEvents error:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getEvent
// ---------------------------------------------------------------------------

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const script = `tell application "Calendar"
  try
    repeat with cal in calendars
      repeat with evt in events of cal
        if uid of evt is "${escapeAS(id)}" then
          ${READ_EVT_FIELDS}
          return ${EVT_RECORD}
        end if
      end repeat
    end repeat
    return ""
  on error
    return ""
  end try
  end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return null;
    return parseEvent(raw);
  } catch (error) {
    console.error("getEvent error:", error);
    return null;
  }
}

export default { listCalendars, listEvents, searchEvents, getEvent };
```

- [ ] **Step 4: Update `utils/calendar.ts` to barrel (Task 1 portion)**

Replace the entire file contents with:

```typescript
// utils/calendar.ts — barrel re-export
import core from "./calendar-core.js";
export default { ...core };
```

- [ ] **Step 5: Run tests to verify Task 1 passes**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/calendar.test.ts 2>&1
```

Expected: all 5 tests in Task 1 describe blocks pass (or skip gracefully if no calendar events exist).

- [ ] **Step 6: Commit**

```bash
cd /Users/chris/git/apple-mcp && git add utils/calendar-core.ts utils/calendar.ts tests/integration/calendar.test.ts && git commit -m "feat: add calendar-core with listCalendars, listEvents, searchEvents, getEvent"
```

---

## Task 2: Create `utils/calendar-actions.ts` (write operations)

**Files:**
- Create: `utils/calendar-actions.ts`
- Modify: `tests/integration/calendar.test.ts` (add tests)
- Modify: `utils/calendar.ts` (add actions to barrel)

- [ ] **Step 1: Add failing tests for write operations**

Append to `tests/integration/calendar.test.ts`:

```typescript
describe("calendar_create / createEvent", () => {
  it("returns boolean", async () => {
    const result = await calendarModule.createEvent({
      title: `MCP Test Event ${Date.now()}`,
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 7200000).toISOString(),
    });
    expect(typeof result).toBe("boolean");
    console.log(`createEvent result: ${result}`);
  }, 20000);

  it("returns false for empty title", async () => {
    const result = await calendarModule.createEvent({
      title: "",
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 7200000).toISOString(),
    });
    expect(result).toBe(false);
  }, 5000);

  it("returns false when endDate <= startDate", async () => {
    const now = new Date().toISOString();
    const result = await calendarModule.createEvent({
      title: "Bad Dates",
      startDate: now,
      endDate: now,
    });
    expect(result).toBe(false);
  }, 5000);
});

describe("calendar_update / updateEvent", () => {
  it("returns false for non-existent id", async () => {
    const result = await calendarModule.updateEvent({
      id: "fake-uid-that-does-not-exist-99999",
      title: "Updated",
    });
    expect(result).toBe(false);
  }, 15000);

  it("returns false when no fields to update", async () => {
    const result = await calendarModule.updateEvent({ id: "some-id" });
    expect(result).toBe(false);
  }, 5000);
});

describe("calendar_delete / deleteEvent", () => {
  it("returns false for non-existent id", async () => {
    const result = await calendarModule.deleteEvent("fake-uid-that-does-not-exist-99999");
    expect(result).toBe(false);
  }, 15000);
});

describe("calendar_open / openEvent", () => {
  it("returns boolean", async () => {
    const events = await calendarModule.listEvents({ limit: 1 });
    if (events.length === 0) { console.log("No events to open"); return; }
    const result = await calendarModule.openEvent(events[0].id);
    expect(typeof result).toBe("boolean");
    console.log(`openEvent result: ${result}`);
  }, 20000);

  it("returns false for non-existent id", async () => {
    const result = await calendarModule.openEvent("fake-uid-that-does-not-exist-99999");
    expect(result).toBe(false);
  }, 15000);
});
```

- [ ] **Step 2: Run tests to see new tests fail**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/calendar.test.ts 2>&1 | grep -E "FAIL|pass|fail"
```

Expected: new describe blocks FAIL with `calendarModule.createEvent is not a function`

- [ ] **Step 3: Create `utils/calendar-actions.ts`**

```typescript
// utils/calendar-actions.ts
import { runAppleScript } from "run-applescript";
import { escapeAppleScriptString as escapeAS, formatDateForAppleScript } from "./applescript-utils.js";

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------

export async function createEvent(params: {
  title: string;
  startDate: string;
  endDate: string;
  calendar?: string;
  location?: string;
  notes?: string;
  url?: string;
  isAllDay?: boolean;
}): Promise<boolean> {
  const { title, startDate, endDate, calendar, location, notes, url, isAllDay = false } = params;
  if (!title.trim()) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return false;

  const startStr = escapeAS(formatDateForAppleScript(start));
  const endStr = escapeAS(formatDateForAppleScript(end));
  const calClause = calendar
    ? `try\n      set targetCal to calendar "${escapeAS(calendar)}"\n    on error\n      set targetCal to first calendar whose writable is true\n    end try`
    : `set targetCal to first calendar whose writable is true`;
  const locationLine = location ? `set location of newEvent to "${escapeAS(location)}"` : "";
  const notesLine = notes ? `set description of newEvent to "${escapeAS(notes)}"` : "";
  const urlLine = url ? `set url of newEvent to "${escapeAS(url)}"` : "";

  const script = `tell application "Calendar"
  try
    ${calClause}
    tell targetCal
      set newEvent to make new event with properties {summary:"${escapeAS(title)}", start date:date "${startStr}", end date:date "${endStr}", allday event:${isAllDay}}
      ${locationLine}
      ${notesLine}
      ${urlLine}
    end tell
    return "ok"
  on error errMsg
    return "error:" & errMsg
  end try
  end tell`;

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("createEvent error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// updateEvent
// ---------------------------------------------------------------------------

export async function updateEvent(params: {
  id: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  notes?: string;
  url?: string;
}): Promise<boolean> {
  const { id, title, startDate, endDate, location, notes, url } = params;

  const lines: string[] = [];
  if (title !== undefined) lines.push(`set summary of evt to "${escapeAS(title)}"`);
  if (startDate !== undefined) lines.push(`set start date of evt to date "${escapeAS(formatDateForAppleScript(new Date(startDate)))}"`);
  if (endDate !== undefined) lines.push(`set end date of evt to date "${escapeAS(formatDateForAppleScript(new Date(endDate)))}"`);
  if (location !== undefined) lines.push(`set location of evt to "${escapeAS(location)}"`);
  if (notes !== undefined) lines.push(`set description of evt to "${escapeAS(notes)}"`);
  if (url !== undefined) lines.push(`set url of evt to "${escapeAS(url)}"`);
  if (lines.length === 0) return false;

  const script = `tell application "Calendar"
  try
    repeat with cal in calendars
      repeat with evt in events of cal
        if uid of evt is "${escapeAS(id)}" then
          ${lines.join("\n          ")}
          return "ok"
        end if
      end repeat
    end repeat
    return "error:Event not found"
  on error errMsg
    return "error:" & errMsg
  end try
  end tell`;

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("updateEvent error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------

export async function deleteEvent(id: string): Promise<boolean> {
  const script = `tell application "Calendar"
  try
    repeat with cal in calendars
      repeat with evt in events of cal
        if uid of evt is "${escapeAS(id)}" then
          delete evt
          return "ok"
        end if
      end repeat
    end repeat
    return "error:Event not found"
  on error errMsg
    return "error:" & errMsg
  end try
  end tell`;

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("deleteEvent error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// openEvent
// ---------------------------------------------------------------------------

export async function openEvent(id: string): Promise<boolean> {
  const script = `tell application "Calendar"
  try
    activate
    repeat with cal in calendars
      repeat with evt in events of cal
        if uid of evt is "${escapeAS(id)}" then
          show evt
          return "ok"
        end if
      end repeat
    end repeat
    return "error:Event not found"
  on error errMsg
    return "error:" & errMsg
  end try
  end tell`;

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("openEvent error:", error);
    return false;
  }
}

export default { createEvent, updateEvent, deleteEvent, openEvent };
```

- [ ] **Step 4: Update `utils/calendar.ts` to include actions**

```typescript
// utils/calendar.ts — barrel re-export
import core from "./calendar-core.js";
import actions from "./calendar-actions.js";
export default { ...core, ...actions };
```

- [ ] **Step 5: Run tests to verify Task 2 passes**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/calendar.test.ts 2>&1
```

Expected: all tests in Task 1 and Task 2 describe blocks pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/chris/git/apple-mcp && git add utils/calendar-actions.ts utils/calendar.ts tests/integration/calendar.test.ts && git commit -m "feat: add calendar-actions with createEvent, updateEvent, deleteEvent, openEvent"
```

---

## Task 3: Create `utils/calendar-manage.ts` (availability operations)

**Files:**
- Create: `utils/calendar-manage.ts`
- Modify: `tests/integration/calendar.test.ts` (add tests)
- Modify: `utils/calendar.ts` (finalize barrel)

- [ ] **Step 1: Add failing tests for availability operations**

Append to `tests/integration/calendar.test.ts`:

```typescript
describe("calendar_get_free_busy / getFreeBusy", () => {
  it("returns array of BusyBlock objects", async () => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const blocks = await calendarModule.getFreeBusy({
      startDate: now.toISOString(),
      endDate: nextWeek.toISOString(),
    });
    expect(Array.isArray(blocks)).toBe(true);
    for (const b of blocks) {
      expect(typeof b.title).toBe("string");
      expect(b.startDate instanceof Date).toBe(true);
      expect(b.endDate instanceof Date).toBe(true);
      expect(typeof b.calendarName).toBe("string");
    }
    console.log(`getFreeBusy returned ${blocks.length} busy blocks`);
  }, 20000);
});

describe("calendar_find_slots / findAvailableSlots", () => {
  it("returns array of AvailableSlot objects", async () => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const slots = await calendarModule.findAvailableSlots({
      startDate: now.toISOString(),
      endDate: nextWeek.toISOString(),
      durationMinutes: 60,
    });
    expect(Array.isArray(slots)).toBe(true);
    for (const s of slots) {
      expect(s.startDate instanceof Date).toBe(true);
      expect(s.endDate instanceof Date).toBe(true);
      // Each slot must be at least durationMinutes long
      const durationMs = s.endDate.getTime() - s.startDate.getTime();
      expect(durationMs).toBeGreaterThanOrEqual(60 * 60 * 1000);
    }
    console.log(`findAvailableSlots returned ${slots.length} slots`);
  }, 20000);

  it("returns empty array when range is too small for duration", async () => {
    const now = new Date();
    const inTenMinutes = new Date(now.getTime() + 10 * 60 * 1000);
    const slots = await calendarModule.findAvailableSlots({
      startDate: now.toISOString(),
      endDate: inTenMinutes.toISOString(),
      durationMinutes: 60,
    });
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBe(0);
  }, 20000);
});
```

- [ ] **Step 2: Run tests to see new tests fail**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/calendar.test.ts 2>&1 | grep -E "FAIL|pass|fail"
```

Expected: new describe blocks FAIL with `calendarModule.getFreeBusy is not a function`

- [ ] **Step 3: Create `utils/calendar-manage.ts`**

```typescript
// utils/calendar-manage.ts
import { runAppleScript } from "run-applescript";
import { escapeAppleScriptString as escapeAS, formatDateForAppleScript } from "./applescript-utils.js";
import type { BusyBlock, AvailableSlot } from "./calendar-core.js";

const AS_DATE_STR = `((year of d) as string) & "-" & ((month of d as integer) as string) & "-" & ((day of d) as string) & "-" & ((hours of d) as string) & "-" & ((minutes of d) as string) & "-" & ((seconds of d) as string)`;

function parseASDate(s: string): Date {
  const parts = s.split("-").map(Number);
  if (parts.length === 6 && parts.every(n => !isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ---------------------------------------------------------------------------
// getFreeBusy
// ---------------------------------------------------------------------------

export async function getFreeBusy(params: {
  startDate: string;
  endDate: string;
  calendar?: string;
}): Promise<BusyBlock[]> {
  const { startDate, endDate, calendar: calFilter } = params;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const startStr = escapeAS(formatDateForAppleScript(start));
  const endStr = escapeAS(formatDateForAppleScript(end));
  const calIteration = calFilter
    ? `repeat with cal in (calendars whose name is "${escapeAS(calFilter)}")`
    : `repeat with cal in calendars`;

  const script = `tell application "Calendar"
  try
    set outputText to ""
    set evtCount to 0
    set startBound to date "${startStr}"
    set endBound to date "${endStr}"
    ${calIteration}
      set calName to name of cal
      set rangeEvents to (events of cal whose start date >= startBound and start date <= endBound)
      repeat with evt in rangeEvents
        try
          set evtTitle to summary of evt
          set d to start date of evt
          set evtStart to ${AS_DATE_STR}
          set d to end date of evt
          set evtEnd to ${AS_DATE_STR}
          if evtCount > 0 then set outputText to outputText & "|||ITEM|||"
          set outputText to outputText & evtTitle & "|||" & evtStart & "|||" & evtEnd & "|||" & calName
          set evtCount to evtCount + 1
        end try
      end repeat
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
      if (parts.length < 4) return [];
      return [{
        title: parts[0],
        startDate: parseASDate(parts[1]),
        endDate: parseASDate(parts[2]),
        calendarName: parts[3],
      }];
    });
  } catch (error) {
    console.error("getFreeBusy error:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// findAvailableSlots
// ---------------------------------------------------------------------------

export async function findAvailableSlots(params: {
  startDate: string;
  endDate: string;
  durationMinutes: number;
  calendar?: string;
}): Promise<AvailableSlot[]> {
  const { startDate, endDate, durationMinutes, calendar } = params;

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);
  const durationMs = durationMinutes * 60 * 1000;

  if (rangeEnd.getTime() - rangeStart.getTime() < durationMs) return [];

  const busyBlocks = await getFreeBusy({ startDate, endDate, calendar });

  const sorted = busyBlocks
    .filter(b => b.endDate > rangeStart && b.startDate < rangeEnd)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const slots: AvailableSlot[] = [];
  let cursor = rangeStart;

  for (const block of sorted) {
    const blockStart = block.startDate < rangeStart ? rangeStart : block.startDate;
    const blockEnd = block.endDate > rangeEnd ? rangeEnd : block.endDate;

    if (blockStart.getTime() - cursor.getTime() >= durationMs) {
      slots.push({ startDate: new Date(cursor), endDate: new Date(blockStart) });
    }
    if (blockEnd > cursor) cursor = blockEnd;
  }

  if (rangeEnd.getTime() - cursor.getTime() >= durationMs) {
    slots.push({ startDate: new Date(cursor), endDate: new Date(rangeEnd) });
  }

  return slots;
}

export default { getFreeBusy, findAvailableSlots };
```

- [ ] **Step 4: Finalize `utils/calendar.ts` barrel**

```typescript
// utils/calendar.ts — barrel re-export
import core from "./calendar-core.js";
import actions from "./calendar-actions.js";
import manage from "./calendar-manage.js";
export default { ...core, ...actions, ...manage };
```

- [ ] **Step 5: Run all tests to verify everything passes**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/calendar.test.ts 2>&1
```

Expected: all tests pass (or skip gracefully if calendar has no events).

- [ ] **Step 6: Commit**

```bash
cd /Users/chris/git/apple-mcp && git add utils/calendar-manage.ts utils/calendar.ts tests/integration/calendar.test.ts && git commit -m "feat: add calendar-manage with getFreeBusy, findAvailableSlots; finalize barrel"
```

---

## Task 4: Update `tools.ts` — remove `CALENDAR_TOOL`, add 10 `calendar_*` constants

**Files:**
- Modify: `tools.ts`

Context: `CALENDAR_TOOL` starts at approximately line 129 and ends before the `MAIL_SEARCH_TOOL` constant. The `tools` array at ~line 562 includes `CALENDAR_TOOL`. Both need updating.

- [ ] **Step 1: Remove `CALENDAR_TOOL` and add 10 calendar tool constants**

Delete the entire `CALENDAR_TOOL` constant block (from `const CALENDAR_TOOL: Tool = {` through its closing `};`).

Add these 10 constants in its place (after the MAPS_TOOL block and before the MAIL tools):

```typescript
const CALENDAR_LIST_TOOL: Tool = {
  name: "calendar_list",
  description: "List calendar events in a date range",
  inputSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start date in ISO format (default: today)" },
      endDate:   { type: "string", description: "End date in ISO format (default: 7 days from now)" },
      calendar:  { type: "string", description: "Calendar name to filter by" },
      limit:     { type: "number", description: "Max results (default 50)" },
    },
  },
};

const CALENDAR_SEARCH_TOOL: Tool = {
  name: "calendar_search",
  description: "Search calendar events by title or notes text",
  inputSchema: {
    type: "object",
    properties: {
      query:     { type: "string", description: "Text to search for in event title or notes" },
      startDate: { type: "string", description: "Start of search range in ISO format (default: today)" },
      endDate:   { type: "string", description: "End of search range in ISO format (default: 30 days out)" },
      calendar:  { type: "string", description: "Calendar name to filter by" },
      limit:     { type: "number", description: "Max results (default 50)" },
    },
    required: ["query"],
  },
};

const CALENDAR_GET_TOOL: Tool = {
  name: "calendar_get",
  description: "Get full details of a specific calendar event by its UID, including attendees",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Event UID (from calendar_list or calendar_search)" },
    },
    required: ["id"],
  },
};

const CALENDAR_CREATE_TOOL: Tool = {
  name: "calendar_create",
  description: "Create a new calendar event",
  inputSchema: {
    type: "object",
    properties: {
      title:     { type: "string", description: "Event title" },
      startDate: { type: "string", description: "Start date/time in ISO format" },
      endDate:   { type: "string", description: "End date/time in ISO format" },
      calendar:  { type: "string", description: "Calendar name (uses first writable calendar if omitted)" },
      location:  { type: "string", description: "Event location" },
      notes:     { type: "string", description: "Event notes" },
      url:       { type: "string", description: "Event URL" },
      isAllDay:  { type: "boolean", description: "Whether this is an all-day event (default false)" },
    },
    required: ["title", "startDate", "endDate"],
  },
};

const CALENDAR_UPDATE_TOOL: Tool = {
  name: "calendar_update",
  description: "Update fields on an existing calendar event",
  inputSchema: {
    type: "object",
    properties: {
      id:        { type: "string", description: "Event UID" },
      title:     { type: "string", description: "New event title" },
      startDate: { type: "string", description: "New start date/time in ISO format" },
      endDate:   { type: "string", description: "New end date/time in ISO format" },
      location:  { type: "string", description: "New location" },
      notes:     { type: "string", description: "New notes" },
      url:       { type: "string", description: "New URL" },
    },
    required: ["id"],
  },
};

const CALENDAR_DELETE_TOOL: Tool = {
  name: "calendar_delete",
  description: "Delete a calendar event (moves to trash)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Event UID" },
    },
    required: ["id"],
  },
};

const CALENDAR_OPEN_TOOL: Tool = {
  name: "calendar_open",
  description: "Open a specific calendar event in Calendar.app",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Event UID" },
    },
    required: ["id"],
  },
};

const CALENDAR_LIST_CALENDARS_TOOL: Tool = {
  name: "calendar_list_calendars",
  description: "List all calendars in Calendar.app",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const CALENDAR_GET_FREE_BUSY_TOOL: Tool = {
  name: "calendar_get_free_busy",
  description: "Get busy blocks (existing events) in a date range — useful for finding free time",
  inputSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start of range in ISO format" },
      endDate:   { type: "string", description: "End of range in ISO format" },
      calendar:  { type: "string", description: "Calendar name to filter by" },
    },
    required: ["startDate", "endDate"],
  },
};

const CALENDAR_FIND_SLOTS_TOOL: Tool = {
  name: "calendar_find_slots",
  description: "Find available time slots in a date range that fit a minimum duration",
  inputSchema: {
    type: "object",
    properties: {
      startDate:       { type: "string", description: "Start of range in ISO format" },
      endDate:         { type: "string", description: "End of range in ISO format" },
      durationMinutes: { type: "number", description: "Minimum slot duration in minutes" },
      calendar:        { type: "string", description: "Calendar name to filter by" },
    },
    required: ["startDate", "endDate", "durationMinutes"],
  },
};
```

- [ ] **Step 2: Update the `tools` array**

Find the line:
```typescript
CONTACTS_TOOL, NOTES_TOOL, MESSAGES_TOOL, REMINDERS_TOOL, CALENDAR_TOOL, MAPS_TOOL,
```

Replace with:
```typescript
CONTACTS_TOOL, NOTES_TOOL, MESSAGES_TOOL, REMINDERS_TOOL, MAPS_TOOL,
  // Calendar tools (10)
  CALENDAR_LIST_TOOL, CALENDAR_SEARCH_TOOL, CALENDAR_GET_TOOL, CALENDAR_CREATE_TOOL,
  CALENDAR_UPDATE_TOOL, CALENDAR_DELETE_TOOL, CALENDAR_OPEN_TOOL,
  CALENDAR_LIST_CALENDARS_TOOL, CALENDAR_GET_FREE_BUSY_TOOL, CALENDAR_FIND_SLOTS_TOOL,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/chris/git/apple-mcp && bun run --elide-lines=0 index.ts --help 2>&1 | head -5
```

Expected: server starts without TypeScript errors (or shows help/usage)

- [ ] **Step 4: Commit**

```bash
cd /Users/chris/git/apple-mcp && git add tools.ts && git commit -m "feat: add 10 calendar_* tool constants, remove CALENDAR_TOOL"
```

---

## Task 5: Update `index.ts` — remove old handler, add 10 new handlers

**Files:**
- Modify: `index.ts`

Context: The old `case "calendar":` block is at ~line 992. The `isCalendarArgs` function is at ~line 1516. Both must be removed and replaced with 10 direct handlers matching the mail pattern.

- [ ] **Step 1: Remove the `case "calendar":` block**

Find and delete the entire block:
```typescript
case "calendar": {
    if (!isCalendarArgs(args)) {
        throw new Error("Invalid arguments for calendar tool");
    }
    // ... (entire block through closing `}` before `case "maps":`)
```

Replace it with the 10 new handlers:

```typescript
case "calendar_list": {
  const calModule = await loadModule("calendar");
  const { startDate, endDate, calendar, limit } = args as {
    startDate?: string; endDate?: string; calendar?: string; limit?: number;
  };
  const events = await calModule.listEvents({ startDate, endDate, calendar, limit });
  return {
    content: [{ type: "text", text: events.length ? JSON.stringify(events, null, 2) : "No events found." }],
    isError: false,
  };
}

case "calendar_search": {
  const calModule = await loadModule("calendar");
  const { query, startDate, endDate, calendar, limit } = args as {
    query: string; startDate?: string; endDate?: string; calendar?: string; limit?: number;
  };
  if (!query) throw new Error("query is required");
  const events = await calModule.searchEvents({ query, startDate, endDate, calendar, limit });
  return {
    content: [{ type: "text", text: events.length ? JSON.stringify(events, null, 2) : `No events found matching "${query}".` }],
    isError: false,
  };
}

case "calendar_get": {
  const calModule = await loadModule("calendar");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const event = await calModule.getEvent(id);
  return {
    content: [{ type: "text", text: event ? JSON.stringify(event, null, 2) : `Event ${id} not found.` }],
    isError: false,
  };
}

case "calendar_create": {
  const calModule = await loadModule("calendar");
  const { title, startDate, endDate, calendar, location, notes, url, isAllDay } = args as {
    title: string; startDate: string; endDate: string; calendar?: string;
    location?: string; notes?: string; url?: string; isAllDay?: boolean;
  };
  if (!title) throw new Error("title is required");
  if (!startDate) throw new Error("startDate is required");
  if (!endDate) throw new Error("endDate is required");
  const ok = await calModule.createEvent({ title, startDate, endDate, calendar, location, notes, url, isAllDay });
  return {
    content: [{ type: "text", text: ok ? `Event "${title}" created successfully.` : "Failed to create event." }],
    isError: !ok,
  };
}

case "calendar_update": {
  const calModule = await loadModule("calendar");
  const { id, title, startDate, endDate, location, notes, url } = args as {
    id: string; title?: string; startDate?: string; endDate?: string;
    location?: string; notes?: string; url?: string;
  };
  if (!id) throw new Error("id is required");
  const ok = await calModule.updateEvent({ id, title, startDate, endDate, location, notes, url });
  return {
    content: [{ type: "text", text: ok ? `Event ${id} updated successfully.` : `Event ${id} not found or nothing to update.` }],
    isError: !ok,
  };
}

case "calendar_delete": {
  const calModule = await loadModule("calendar");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await calModule.deleteEvent(id);
  return {
    content: [{ type: "text", text: ok ? `Event ${id} deleted.` : `Event ${id} not found.` }],
    isError: !ok,
  };
}

case "calendar_open": {
  const calModule = await loadModule("calendar");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await calModule.openEvent(id);
  return {
    content: [{ type: "text", text: ok ? `Opened event ${id} in Calendar.app.` : `Event ${id} not found.` }],
    isError: !ok,
  };
}

case "calendar_list_calendars": {
  const calModule = await loadModule("calendar");
  const calendars = await calModule.listCalendars();
  return {
    content: [{ type: "text", text: calendars.length ? JSON.stringify(calendars, null, 2) : "No calendars found." }],
    isError: false,
  };
}

case "calendar_get_free_busy": {
  const calModule = await loadModule("calendar");
  const { startDate, endDate, calendar } = args as {
    startDate: string; endDate: string; calendar?: string;
  };
  if (!startDate) throw new Error("startDate is required");
  if (!endDate) throw new Error("endDate is required");
  const blocks = await calModule.getFreeBusy({ startDate, endDate, calendar });
  return {
    content: [{ type: "text", text: blocks.length ? JSON.stringify(blocks, null, 2) : "No busy blocks found in this range." }],
    isError: false,
  };
}

case "calendar_find_slots": {
  const calModule = await loadModule("calendar");
  const { startDate, endDate, durationMinutes, calendar } = args as {
    startDate: string; endDate: string; durationMinutes: number; calendar?: string;
  };
  if (!startDate) throw new Error("startDate is required");
  if (!endDate) throw new Error("endDate is required");
  if (!durationMinutes) throw new Error("durationMinutes is required");
  const slots = await calModule.findAvailableSlots({ startDate, endDate, durationMinutes, calendar });
  return {
    content: [{ type: "text", text: slots.length ? JSON.stringify(slots, null, 2) : `No available slots of ${durationMinutes} minutes found in this range.` }],
    isError: false,
  };
}
```

- [ ] **Step 2: Remove the `isCalendarArgs` function**

Find and delete the entire function:
```typescript
function isCalendarArgs(args: unknown): args is {
    operation: "search" | "open" | "list" | "create";
    // ... through closing `}`
```

- [ ] **Step 3: Verify no remaining references to `isCalendarArgs` or `CALENDAR_TOOL`**

```bash
cd /Users/chris/git/apple-mcp && grep -n "isCalendarArgs\|CALENDAR_TOOL\|case \"calendar\":" index.ts tools.ts
```

Expected: no output (zero matches)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chris/git/apple-mcp && bun run index.ts --help 2>&1 | head -5
```

Expected: server starts or prints usage without errors

- [ ] **Step 5: Commit**

```bash
cd /Users/chris/git/apple-mcp && git add index.ts && git commit -m "feat: replace monolithic calendar handler with 10 granular calendar_* cases"
```

---

## Task 6: Final verification

**Files:** none modified

- [ ] **Step 1: Run the full integration test suite**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/calendar.test.ts 2>&1
```

Expected: all tests pass (or skip gracefully where no calendar data exists).

- [ ] **Step 2: Run mail integration tests to confirm no regressions**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/mail.test.ts 2>&1 | tail -10
```

Expected: same pass/fail ratio as before this change.

- [ ] **Step 3: Verify server lists all 10 calendar tools**

```bash
cd /Users/chris/git/apple-mcp && bun run index.ts 2>/dev/null &
sleep 2
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | bun run index.ts 2>/dev/null | grep -o '"calendar[^"]*"' | sort
kill %1 2>/dev/null
```

Expected output includes:
```
"calendar_create"
"calendar_delete"
"calendar_find_slots"
"calendar_get"
"calendar_get_free_busy"
"calendar_list"
"calendar_list_calendars"
"calendar_open"
"calendar_search"
"calendar_update"
```

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
cd /Users/chris/git/apple-mcp && git status
```

If clean: nothing to do. If any stray changes: stage and commit them with a descriptive message.
