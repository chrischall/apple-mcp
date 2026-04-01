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
// Performance tuning
// ---------------------------------------------------------------------------

// Calendars with more events than this threshold take too long to scan with
// the AppleScript `whose start date >= ...` filter (which is O(n) over all
// events). When no specific calendar is requested we skip large calendars so
// that operations complete within a reasonable time budget (~10s).
// When `calendar` is explicitly specified the threshold is ignored.
const MAX_CALENDAR_SIZE_FOR_AUTO_SCAN = 150;

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

  // When a specific calendar is requested, query it directly (ignore size limit).
  // When no calendar is specified, skip large calendars to keep response times
  // within a reasonable budget (large calendars can have thousands of events and
  // the AppleScript `whose` filter scans all of them).
  const calIterationAndFilter = calFilter
    ? `repeat with cal in (calendars whose name is "${escapeAS(calFilter)}")`
    : `repeat with cal in calendars
      set calSize to count of events of cal
      if calSize > ${MAX_CALENDAR_SIZE_FOR_AUTO_SCAN} then
        -- skip large calendar: too slow to date-filter with AppleScript
      else`;

  const calIterationClose = calFilter
    ? `end repeat`
    : `      end if
    end repeat`;

  const script = `tell application "Calendar"
  try
    set outputText to ""
    set evtCount to 0
    set startBound to date "${startStr}"
    set endBound to date "${endStr}"
    ${calIterationAndFilter}
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
    ${calIterationClose}
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

  const calIterationAndFilter = calFilter
    ? `repeat with cal in (calendars whose name is "${escapeAS(calFilter)}")`
    : `repeat with cal in calendars
      set calSize to count of events of cal
      if calSize > ${MAX_CALENDAR_SIZE_FOR_AUTO_SCAN} then
        -- skip large calendar: too slow to date-filter with AppleScript
      else`;

  const calIterationClose = calFilter
    ? `end repeat`
    : `      end if
    end repeat`;

  const script = `tell application "Calendar"
  try
    set outputText to ""
    set evtCount to 0
    set startBound to date "${startStr}"
    set endBound to date "${endStr}"
    ${calIterationAndFilter}
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
    ${calIterationClose}
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
  // Search within a bounded date range to avoid full-calendar scans.
  // Using the same calendar-size threshold as listEvents so that events
  // returned by listEvents can always be retrieved by getEvent.
  const now = new Date();
  const searchStart = new Date(now.getFullYear() - 1, 0, 1); // 1 year back
  const searchEnd = new Date(now.getFullYear() + 2, 11, 31); // 2 years forward
  const startStr = escapeAS(formatDateForAppleScript(searchStart));
  const endStr = escapeAS(formatDateForAppleScript(searchEnd));

  const script = `tell application "Calendar"
  try
    set startBound to date "${startStr}"
    set endBound to date "${endStr}"
    repeat with cal in calendars
      set calSize to count of events of cal
      if calSize <= ${MAX_CALENDAR_SIZE_FOR_AUTO_SCAN} then
        set rangeEvents to (events of cal whose start date >= startBound and start date <= endBound)
        repeat with evt in rangeEvents
          if uid of evt is "${escapeAS(id)}" then
            ${READ_EVT_FIELDS}
            return ${EVT_RECORD}
          end if
        end repeat
      end if
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
