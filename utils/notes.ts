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
  try
    set outputText to ""
    repeat with f in folders
      set fname to name of f
      if outputText is not "" then set outputText to outputText & "|||ITEM|||"
      set outputText to outputText & fname
    end repeat
    return outputText
  on error errMsg
    return "error:" & errMsg
  end try
end tell`;
  try {
    const raw = await runAppleScript(script);
    if (!raw.trim() || raw.startsWith("error:")) return [];
    return raw.split("|||ITEM|||").map(name => ({ name }));
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
