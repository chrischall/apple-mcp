// utils/calendar-manage.ts
import { runAppleScript } from "run-applescript";
import { escapeAppleScriptString as escapeAS, formatDateForAppleScript } from "./applescript-utils.js";
import type { BusyBlock, AvailableSlot } from "./calendar-core.js";

const AS_DATE_STR = `((year of d) as string) & "-" & ((month of d as integer) as string) & "-" & ((day of d) as string) & "-" & ((hours of d) as string) & "-" & ((minutes of d) as string) & "-" & ((seconds of d) as string)`;

// Calendars with more events than this threshold are too slow to scan with
// AppleScript `whose start date >= ...` (O(n) over all events). Skip large
// calendars unless the caller explicitly names one.
const MAX_CALENDAR_SIZE_FOR_AUTO_SCAN = 150;

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
