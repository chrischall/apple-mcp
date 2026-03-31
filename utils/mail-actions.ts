// utils/mail-actions.ts
import { runAppleScript } from "run-applescript";
import { escapeAS, validateId, findMsgScript, appScript } from "./mail-core.js";

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function findAndAct(id: string, operation: string): Promise<boolean> {
  validateId(id);
  try {
    const raw = await runAppleScript(findMsgScript(id, operation));
    return raw.trim() === "ok";
  } catch (error) {
    console.error(`Mail action error:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Mark read / unread
// ---------------------------------------------------------------------------

export async function markAsRead(id: string): Promise<boolean> {
  return findAndAct(id, "set read status of msg to true");
}

export async function markAsUnread(id: string): Promise<boolean> {
  return findAndAct(id, "set read status of msg to false");
}

// ---------------------------------------------------------------------------
// Flag / unflag
// ---------------------------------------------------------------------------

export async function flagMessage(id: string): Promise<boolean> {
  // flagged status is an integer in Apple Mail (0=none, 1–7=colors).
  // Setting to true coerces to 1 (orange flag).
  return findAndAct(id, "set flagged status of msg to true");
}

export async function unflagMessage(id: string): Promise<boolean> {
  return findAndAct(id, "set flagged status of msg to false");
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteMessage(id: string): Promise<boolean> {
  return findAndAct(id, "delete msg");
}

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

export async function moveMessage(params: {
  id: string;
  mailbox: string;
  account?: string;
}): Promise<boolean> {
  const { id, mailbox, account } = params;
  validateId(id);

  const accountClause = account
    ? `mailbox "${escapeAS(mailbox)}" of account "${escapeAS(account)}"`
    : `mailbox "${escapeAS(mailbox)}" of (account 1)`;

  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            set destMailbox to ${accountClause}
            move msg to destMailbox
            return "ok"
          end if
        end try
      end repeat
    end repeat
    return "error:Message not found"
  on error errMsg
    return "error:" & errMsg
  end try`);

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("moveMessage error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reply
// ---------------------------------------------------------------------------

export async function replyToMessage(params: {
  id: string;
  body: string;
  replyAll?: boolean;
  account?: string;
}): Promise<boolean> {
  const { id, body, replyAll = false, account } = params;
  validateId(id);

  const safeBody = escapeAS(body);
  const replyAllClause = replyAll ? " with reply to all" : "";
  const senderLine = account ? `set sender of theReply to "${escapeAS(account)}"` : "";

  const operation = `set theReply to reply msg with opening window${replyAllClause}
            ${senderLine}
            set content of theReply to "${safeBody}" & return & return & content of theReply
            send theReply
            return "ok"`;

  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            ${operation}
          end if
        end try
      end repeat
    end repeat
    return "error:Message not found"
  on error errMsg
    return "error:" & errMsg
  end try`);

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("replyToMessage error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Forward
// ---------------------------------------------------------------------------

export async function forwardMessage(params: {
  id: string;
  to: string[];
  body?: string;
  account?: string;
}): Promise<boolean> {
  const { id, to, body, account } = params;
  validateId(id);

  const recipientCmds = to
    .map(a => `make new to recipient at end of to recipients of theForward with properties {address:"${escapeAS(a)}"}`)
    .join("\n            ");

  const bodyLine = body
    ? `set content of theForward to "${escapeAS(body)}" & return & return & content of theForward`
    : "";
  const senderLine = account ? `set sender of theForward to "${escapeAS(account)}"` : "";

  const operation = `set theForward to forward msg with opening window
            ${senderLine}
            ${recipientCmds}
            ${bodyLine}
            send theForward
            return "ok"`;

  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            ${operation}
          end if
        end try
      end repeat
    end repeat
    return "error:Message not found"
  on error errMsg
    return "error:" & errMsg
  end try`);

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("forwardMessage error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Create draft
// ---------------------------------------------------------------------------

export async function createDraft(params: {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  account?: string;
}): Promise<boolean> {
  const { to, subject, body, cc, bcc, account } = params;
  if (!to || to.length === 0) return false;

  const safeSubject = escapeAS(subject);
  const safeBody = escapeAS(body);

  let recipientCmds = to
    .map(a => `make new to recipient at end of to recipients with properties {address:"${escapeAS(a)}"}`)
    .join("\n");
  if (cc) {
    recipientCmds += "\n" + cc
      .map(a => `make new cc recipient at end of cc recipients with properties {address:"${escapeAS(a)}"}`)
      .join("\n");
  }
  if (bcc) {
    recipientCmds += "\n" + bcc
      .map(a => `make new bcc recipient at end of bcc recipients with properties {address:"${escapeAS(a)}"}`)
      .join("\n");
  }

  // `account` is a full email address that sets the From header (sender property)
  const senderLine = account ? `set sender to "${escapeAS(account)}"` : "";

  const script = appScript(`
    set newMessage to make new outgoing message with properties {subject:"${safeSubject}", content:"${safeBody}", visible:false}
    tell newMessage
      ${recipientCmds}
      ${senderLine}
    end tell
    return "draft created"`);

  try {
    const raw = await runAppleScript(script);
    return raw.includes("draft created");
  } catch (error) {
    console.error("createDraft error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default {
  markAsRead,
  markAsUnread,
  flagMessage,
  unflagMessage,
  deleteMessage,
  moveMessage,
  replyToMessage,
  forwardMessage,
  createDraft,
};
