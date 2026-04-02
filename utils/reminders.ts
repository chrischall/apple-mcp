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
  // Batch property access: id of lists and name of lists are fast inline fetches
  const script = `tell application "Reminders"
  activate
  set ids to id of lists
  set nms to name of lists
  set outputText to ""
  repeat with i from 1 to count of ids
    if i > 1 then set outputText to outputText & "|||ITEM|||"
    set outputText to outputText & item i of ids & "|||" & item i of nms
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

// Build a batch-fetch block for a list, fetching all properties inline.
// Key pattern: "prop of (reminders of l whose ...)" must be done inline (not from a var)
// because materializing a filtered list reference to a variable breaks property access.
function buildBatchFetch(completedFilter: string): string {
  return `set ids to id of (reminders of l ${completedFilter})
        set nms to name of (reminders of l ${completedFilter})
        set bods to body of (reminders of l ${completedFilter})
        set dues to due date of (reminders of l ${completedFilter})
        set priors to priority of (reminders of l ${completedFilter})
        set compls to completed of (reminders of l ${completedFilter})`;
}

export async function listReminders(params: {
  list?: string;
  includeCompleted?: boolean;
  limit?: number;
}): Promise<Reminder[]> {
  const { list: listFilter, includeCompleted = false, limit = 50 } = params;
  const completedFilter = includeCompleted ? "" : "whose completed is false";

  const listOpen = listFilter
    ? `repeat with l in (lists whose name is "${escapeAS(listFilter)}")`
    : `repeat with l in lists
      set listSize to count of reminders of l
      if listSize > ${MAX_LIST_SIZE_FOR_AUTO_SCAN} then
        -- skip large list
      else`;

  const listClose = listFilter
    ? `end repeat`
    : `      end if
    end repeat`;

  const batchFetch = buildBatchFetch(completedFilter);

  const script = `tell application "Reminders"
  activate
  try
    set outputText to ""
    set rCount to 0
    ${listOpen}
      try
        set listName to name of l
        ${batchFetch}
        set listRemCount to count of ids
        repeat with i from 1 to listRemCount
          if rCount >= ${limit} then exit repeat
          set rbody to ""
          if item i of bods is not missing value then set rbody to item i of bods as string
          set rdue to ""
          if item i of dues is not missing value then set rdue to (item i of dues) as string
          set rcompleted to (item i of compls) as string
          if rCount > 0 then set outputText to outputText & "|||ITEM|||"
          set outputText to outputText & item i of ids & "|||" & item i of nms & "|||" & rbody & "|||" & rcompleted & "|||" & rdue & "|||" & listName & "|||" & ((item i of priors) as string)
          set rCount to rCount + 1
        end repeat
      end try
      if rCount >= ${limit} then exit repeat
    ${listClose}
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
  const nameFilter = `whose completed is false and name contains "${safeQuery}"`;

  const listOpen = listFilter
    ? `repeat with l in (lists whose name is "${escapeAS(listFilter)}")`
    : `repeat with l in lists
      set listSize to count of reminders of l
      if listSize > ${MAX_LIST_SIZE_FOR_AUTO_SCAN} then
        -- skip large list
      else`;

  const listClose = listFilter
    ? `end repeat`
    : `      end if
    end repeat`;

  const batchFetch = buildBatchFetch(nameFilter);

  const script = `tell application "Reminders"
  activate
  try
    set outputText to ""
    set rCount to 0
    ${listOpen}
      try
        set listName to name of l
        ${batchFetch}
        set listRemCount to count of ids
        repeat with i from 1 to listRemCount
          if rCount >= ${limit} then exit repeat
          set rbody to ""
          if item i of bods is not missing value then set rbody to item i of bods as string
          set rdue to ""
          if item i of dues is not missing value then set rdue to (item i of dues) as string
          if rCount > 0 then set outputText to outputText & "|||ITEM|||"
          set outputText to outputText & item i of ids & "|||" & item i of nms & "|||" & rbody & "|||false|||" & rdue & "|||" & listName & "|||" & ((item i of priors) as string)
          set rCount to rCount + 1
        end repeat
      end try
      if rCount >= ${limit} then exit repeat
    ${listClose}
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
  activate
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
  activate
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
