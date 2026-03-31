# Calendar Tools Redesign — Design Spec

## Goal

Fix the broken calendar tool implementation, split it into granular MCP tools following the same pattern established by the mail redesign, and add rich features: event CRUD, multi-calendar support, read-only attendee listing, free-busy lookup, and available slot finding.

## Background

The existing `utils/calendar.ts` has four operations exposed through a single `calendar` MCP tool, but three of them are broken:

- `getEvents()` — returns a hardcoded fake event with a comment "Calendar operations too slow"
- `searchEvents()` — always returns an empty list
- `openEvent()` — just activates Calendar.app without opening the specific event
- `createEvent()` — the only function with a real AppleScript implementation

This redesign replaces all of that with real AppleScript implementations and 10 focused tools.

---

## Architecture

Four files replace the monolithic `utils/calendar.ts`:

| File | Responsibility |
|------|---------------|
| `utils/calendar-core.ts` | Shared helpers, types, `listEvents`, `searchEvents`, `getEvent`, `listCalendars` |
| `utils/calendar-actions.ts` | `createEvent`, `updateEvent`, `deleteEvent`, `openEvent` |
| `utils/calendar-manage.ts` | `getFreeBusy`, `findAvailableSlots` |
| `utils/calendar.ts` | Barrel re-export (replaces old implementation) |

`tools.ts` loses `CALENDAR_TOOL` and gains 10 `calendar_*` tool constants. `index.ts` loses the `case "calendar":` block and gains 10 `case "calendar_*":` handlers.

---

## Shared Types (`calendar-core.ts`)

```typescript
export interface CalendarEvent {
  id: string;           // uid from Calendar.app (string, e.g. "ABC123-...")
  title: string;
  startDate: Date;
  endDate: Date;
  calendarName: string;
  isAllDay: boolean;
  location?: string;
  notes?: string;
  url?: string;
  attendees?: string[]; // read-only, "Name <email>" format
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
```

---

## The 10 Tools

### `calendar_list`
List events in a date range.

**Input:** `startDate?` (ISO string), `endDate?` (ISO string), `calendar?` (name), `limit?` (default 50)

**Behavior:** Defaults to today → 7 days out if no dates provided. Uses AppleScript `whose start date >= date "..." and start date <= date "..."` — Calendar's `whose` on dates is efficient, no scan cap needed. Optionally scopes to a single calendar by name.

**Returns:** `CalendarEvent[]`

---

### `calendar_search`
Search events by title/notes text.

**Input:** `query` (required), `startDate?`, `endDate?`, `calendar?`, `limit?` (default 50)

**Behavior:** Fetches events in date range (defaults: today → 30 days out), filters in-loop where `title contains query or description contains query`. Returns up to `limit` matches.

**Returns:** `CalendarEvent[]`

---

### `calendar_get`
Get a single event by ID with full details including attendees.

**Input:** `id` (required, uid string)

**Behavior:** Searches all calendars using `findEventScript` helper. Reads attendees via `attendees of evt`, formatting each as `"Display Name <email>"` (email may be absent for some attendees).

**Returns:** `CalendarEvent | null`

---

### `calendar_create`
Create a new calendar event.

**Input:** `title`, `startDate`, `endDate`, `calendar?`, `location?`, `notes?`, `url?`, `isAllDay?` (default false)

**Behavior:** Uses `make new event at end of events of calendar "..."`. Returns the new event's `uid` on success (cast to string "ok:uid"). If `calendar` is not provided, uses the default calendar. Dates are passed as AppleScript `date` literals.

**Returns:** `boolean` (true = created successfully)

---

### `calendar_update`
Update fields on an existing event.

**Input:** `id` (required), `title?`, `startDate?`, `endDate?`, `location?`, `notes?`, `url?`

**Behavior:** Finds event by UID across all calendars using `findEventScript`. Sets only provided fields. Returns "ok" on success.

**Returns:** `boolean`

---

### `calendar_delete`
Delete a calendar event.

**Input:** `id` (required)

**Behavior:** Finds event by UID, calls `delete evt`. Calendar.app moves deleted events to trash (recoverable). Returns false for non-existent IDs.

**Returns:** `boolean`

---

### `calendar_open`
Open a specific event in Calendar.app.

**Input:** `id` (required)

**Behavior:** Finds event by UID, calls `show evt`. Fixes the current broken implementation which only activated the app without targeting the event.

**Returns:** `boolean`

---

### `calendar_list_calendars`
List all calendars.

**Input:** *(none)*

**Behavior:** Iterates `calendars` in Calendar.app, reads `name`, `color` (as string), and `writable` property.

**Returns:** `Calendar[]`

---

### `calendar_get_free_busy`
Get busy blocks in a date range.

**Input:** `startDate` (required), `endDate` (required), `calendar?`

**Behavior:** Queries events in the date range (optionally scoped to one calendar). Returns each event as a `BusyBlock` with its title, start, end, and calendar name. Caller can compute free time from the gaps.

**Returns:** `BusyBlock[]`

---

### `calendar_find_slots`
Find available time slots in a date range.

**Input:** `startDate` (required), `endDate` (required), `durationMinutes` (required), `calendar?`

**Behavior:** Fetches all busy blocks in the range (via the same logic as `getFreeBusy`), sorts them by start time, then computes gaps. Returns gaps where `endOfGap - startOfGap >= durationMinutes`. Gap boundaries: range start/end are the outer bounds; event boundaries define the inner gaps.

**Returns:** `AvailableSlot[]`

---

## AppleScript Implementation Details

### Event IDs
Calendar.app uses string UIDs (e.g. `"ABC123-DEF456-..."`), not numeric IDs. No numeric validation. IDs are escaped with `escapeAS` before embedding in AppleScript strings.

### Finding an Event by ID (`findEventScript` helper)
```applescript
tell application "Calendar"
  try
    repeat with cal in calendars
      repeat with evt in events of cal
        if uid of evt is "ESCAPED_ID" then
          OPERATION
          return "ok"
        end if
      end repeat
    end repeat
    return "error:Event not found"
  on error errMsg
    return "error:" & errMsg
  end try
end tell
```

### Date Handling
- Input (TypeScript → AppleScript): ISO date strings passed to AppleScript as `date "YYYY-MM-DD HH:MM:SS"` literals via a `formatDateForAS` helper.
- Output (AppleScript → TypeScript): Uses the same locale-independent `YYYY-M-D-H-m-s` format and `parseASDate` as the mail module (copied into `calendar-core.ts` — not shared across modules).

### Attendees (Read-Only)
```applescript
set attList to ""
repeat with att in attendees of evt
  set attName to display name of att
  set attEmail to ""
  try
    set attEmail to email of att
  end try
  if attList is not "" then set attList to attList & ","
  if attEmail is not "" then
    set attList to attList & attName & " <" & attEmail & ">"
  else
    set attList to attList & attName
  end if
end repeat
```

### Delimiter Convention
Same as mail: `|||ITEM|||` between records, `|||` between fields within a record.

### Error Handling
Every AppleScript block is wrapped in `try/on error errMsg/return "error:" & errMsg`. TypeScript catches exceptions, logs via `console.error`, returns `false` / `null` / `[]` as appropriate.

---

## File-Level Design

### `utils/calendar-core.ts`
- Helpers: `escapeAS`, `parseASDate`, `formatDateForAS`, `findEventScript`, `calApp` (wraps cmd in `tell application "Calendar" ... end tell`)
- Types: `CalendarEvent`, `Calendar`, `BusyBlock`, `AvailableSlot`
- Functions: `listEvents`, `searchEvents`, `getEvent`, `listCalendars`
- Default export: object with all four functions

### `utils/calendar-actions.ts`
- Imports: helpers from `calendar-core.js`
- Functions: `createEvent`, `updateEvent`, `deleteEvent`, `openEvent`
- Default export: object with all four functions

### `utils/calendar-manage.ts`
- Imports: helpers + `BusyBlock`/`AvailableSlot` types from `calendar-core.js`
- Functions: `getFreeBusy`, `findAvailableSlots`
- Default export: object with both functions

### `utils/calendar.ts` (barrel)
```typescript
import core from "./calendar-core.js";
import actions from "./calendar-actions.js";
import manage from "./calendar-manage.js";
export default { ...core, ...actions, ...manage };
```

---

## Testing (`tests/integration/calendar.test.ts`)

| Describe block | Key tests |
|----------------|-----------|
| `calendar_list` | Returns array with correct shape; works with no args (defaults) |
| `calendar_search` | Returns array; impossible query returns empty |
| `calendar_get` | Returns null for fake UID; returns event with attendees array for real event |
| `calendar_create` | Returns boolean; created event appears in subsequent list |
| `calendar_update` | Returns false for fake UID; updates title on real event |
| `calendar_delete` | Returns false for fake UID |
| `calendar_open` | Returns boolean |
| `calendar_list_calendars` | Returns array of `{ name, writable }` objects |
| `calendar_get_free_busy` | Returns array; each block has `startDate`, `endDate`, `calendarName` |
| `calendar_find_slots` | Returns array; each slot `endDate - startDate >= durationMinutes` |

**Timeouts:** 15–20s per test. Calendar.app `whose`-on-dates is efficient; no scan cap concerns.

**Non-destructive approach:** Delete tests use a fake UID (`"fake-uid-that-does-not-exist"`). Create tests create a real event — user can delete manually. Update tests reuse the just-created event ID when available.
