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
    set targetUID to "${escapeAS(id)}"
    repeat with cal in calendars
      try
        set matchEvents to (events of cal whose uid is targetUID)
        if (count of matchEvents) > 0 then
          set evt to item 1 of matchEvents
          ${lines.join("\n          ")}
          return "ok"
        end if
      end try
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
    set targetUID to "${escapeAS(id)}"
    repeat with cal in calendars
      try
        set matchEvents to (events of cal whose uid is targetUID)
        if (count of matchEvents) > 0 then
          delete item 1 of matchEvents
          return "ok"
        end if
      end try
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
    set targetUID to "${escapeAS(id)}"
    repeat with cal in calendars
      try
        set matchEvents to (events of cal whose uid is targetUID)
        if (count of matchEvents) > 0 then
          show item 1 of matchEvents
          return "ok"
        end if
      end try
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
