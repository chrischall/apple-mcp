// utils/mail-core.ts
import { runAppleScript } from "run-applescript";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Escapes text for safe embedding in an AppleScript string literal. */
export function escapeAS(text: string): string {
  if (!text) return "";
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * AppleScript snippet that converts a local variable `d` (date) to
 * the locale-independent string "YYYY-M-D-H-m-s".
 */
export const AS_DATE_STR = `((year of d) as string) & "-" & ((month of d as integer) as string) & "-" & ((day of d) as string) & "-" & ((hours of d) as string) & "-" & ((minutes of d) as string) & "-" & ((seconds of d) as string)`;

/**
 * Parses a "YYYY-M-D-H-m-s" string produced by AS_DATE_STR.
 * Returns a local-time Date (AppleScript dates are in the machine's timezone).
 * Do NOT call .toISOString() on the result — it will shift by the UTC offset.
 * Use .toLocaleString() or pass numeric timestamps for comparisons.
 */
export function parseASDate(s: string): Date {
  const parts = s.split("-").map(Number);
  if (parts.length === 6 && parts.every(n => !isNaN(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
  }
  const cleaned = s.replace(/^date\s+/, "").replace(" at ", " ");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Throws if id is not numeric — prevents AppleScript injection. */
export function validateId(id: string): void {
  if (!/^\d+$/.test(id)) throw new Error(`Message ID must be numeric, got: "${id}"`);
}

/** Builds an account-scoped AppleScript block. */
export function accountScript(account: string, cmd: string): string {
  return `tell application "Mail"\n  tell account "${escapeAS(account)}"\n    ${cmd}\n  end tell\nend tell`;
}

/** Builds an app-level AppleScript block. */
export function appScript(cmd: string): string {
  return `tell application "Mail"\n  ${cmd}\nend tell`;
}

/**
 * Builds the AppleScript to find a message by numeric id across all
 * accounts/mailboxes and perform `operation` on the bound variable `msg`.
 * Returns "ok" on success, "error:<reason>" on failure.
 */
export function findMsgScript(id: string, operation: string): string {
  return appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            ${operation}
            return "ok"
          end if
        end try
      end repeat
    end repeat
    return "error:Message not found"
  on error errMsg
    return "error:" & errMsg
  end try`);
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface EmailMessage {
  id: string;
  subject: string;
  sender: string;
  dateReceived: Date;
  isRead: boolean;
  isFlagged: boolean;
  mailbox: string;
  account: string;
}

export interface MessageContent {
  id: string;
  subject: string;
  plainText: string;
  htmlContent?: string;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseMessageList(output: string, mailbox: string, account: string): EmailMessage[] {
  if (!output.trim()) return [];
  return output.split("|||ITEM|||").flatMap(item => {
    const parts = item.split("|||");
    if (parts.length < 6) return [];
    return [{
      id: parts[0].trim(),
      subject: parts[1],
      sender: parts[2],
      dateReceived: parseASDate(parts[3]),
      isRead: parts[4] === "true",
      isFlagged: parts[5] === "true",
      mailbox,
      account,
    }];
  });
}

async function getFirstAccount(): Promise<string | null> {
  try {
    const raw = await runAppleScript(appScript(`
      if (count of accounts) > 0 then
        return name of account 1
      end if
      return ""`));
    return raw.trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export async function searchMessages(params: {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  mailbox?: string;
  account?: string;
  isRead?: boolean;
  isFlagged?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<EmailMessage[]> {
  const {
    query,
    from,
    to: toFilter,
    subject: subjectFilter,
    mailbox = "INBOX",
    account,
    isRead,
    isFlagged,
    dateFrom,
    dateTo,
    limit = 50,
  } = params;

  // Build in-loop filter checks (applied per message in AppleScript)
  // Cap scan at 30 to stay within AppleScript timeout budget (~100ms/message)
  const scanLimit = Math.min(limit * 2, 30);
  const checks: string[] = [];
  if (query) {
    const q = escapeAS(query);
    checks.push(`(msgSubject contains "${q}" or msgSender contains "${q}")`);
  }
  if (from) checks.push(`msgSender contains "${escapeAS(from)}"`);
  if (toFilter) checks.push(`msgRecipients contains "${escapeAS(toFilter)}"`);
  if (subjectFilter) checks.push(`msgSubject contains "${escapeAS(subjectFilter)}"`);
  if (isRead !== undefined) checks.push(`msgRead = "${isRead}"`);
  if (isFlagged !== undefined) checks.push(`msgFlagged = "${isFlagged}"`);
  if (dateFrom) checks.push(`d >= date "${escapeAS(dateFrom)}"`);
  if (dateTo) checks.push(`d <= date "${escapeAS(dateTo)}"`);

  // Build recipient setup block — only fetched when the `to` filter is used
  const recipientSetup = toFilter
    ? `
        set msgRecipients to ""
        try
          repeat with r in to recipients of msg
            set msgRecipients to msgRecipients & (address of r) & " "
          end repeat
        end try`
    : "";

  const filterClause = checks.length > 0
    ? `if ${checks.join(" and ")} then\n          set include to true\n        end if`
    : `set include to true`;

  const cmd = `
    set outputText to ""
    set msgCount to 0
    set theMailbox to mailbox "${escapeAS(mailbox)}"
    set totalMsgs to count of messages of theMailbox
    set scanEnd to ${scanLimit}
    if scanEnd > totalMsgs then set scanEnd to totalMsgs
    if scanEnd = 0 then return ""
    repeat with msg in (messages 1 thru scanEnd of theMailbox)
      if msgCount >= ${limit} then exit repeat
      try
        set msgId to id of msg as string
        set msgSubject to subject of msg
        set msgSender to sender of msg
        set d to date received of msg
        set msgDate to ${AS_DATE_STR}
        set msgRead to read status of msg as string
        set msgFlagged to (((flagged status of msg as integer) > 0) as string)${recipientSetup}
        set include to false
        ${filterClause}
        if include then
          if msgCount > 0 then set outputText to outputText & "|||ITEM|||"
          set outputText to outputText & msgId & "|||" & msgSubject & "|||" & msgSender & "|||" & msgDate & "|||" & msgRead & "|||" & msgFlagged
          set msgCount to msgCount + 1
        end if
      end try
    end repeat
    return outputText
  `;

  try {
    let output: string;
    if (account) {
      output = await runAppleScript(accountScript(account, cmd));
    } else {
      // No account specified — search first available account only
      const firstAccount = await getFirstAccount();
      if (!firstAccount) return [];
      output = await runAppleScript(accountScript(firstAccount, cmd));
    }
    return parseMessageList(output, mailbox, account ?? "");
  } catch (error) {
    console.error("searchMessages error:", error);
    return [];
  }
}

export async function listMessages(params: {
  mailbox?: string;
  account?: string;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<EmailMessage[]> {
  const { mailbox = "INBOX", account, limit = 50, unreadOnly = false } = params;
  // Cap scan at 50 to keep AppleScript execution within reasonable time
  const scanLimit = unreadOnly ? Math.min(limit * 3, 50) : limit;
  const unreadCheck = unreadOnly ? `if msgRead = "false" then\n          set include to true\n        end if` : `set include to true`;

  const cmd = `
    set outputText to ""
    set msgCount to 0
    set theMailbox to mailbox "${escapeAS(mailbox)}"
    set totalMsgs to count of messages of theMailbox
    set scanEnd to ${scanLimit}
    if scanEnd > totalMsgs then set scanEnd to totalMsgs
    if scanEnd = 0 then return ""
    repeat with msg in (messages 1 thru scanEnd of theMailbox)
      if msgCount >= ${limit} then exit repeat
      try
        set msgId to id of msg as string
        set msgSubject to subject of msg
        set msgSender to sender of msg
        set d to date received of msg
        set msgDate to ${AS_DATE_STR}
        set msgRead to read status of msg as string
        set msgFlagged to (((flagged status of msg as integer) > 0) as string)
        set include to false
        ${unreadCheck}
        if include then
          if msgCount > 0 then set outputText to outputText & "|||ITEM|||"
          set outputText to outputText & msgId & "|||" & msgSubject & "|||" & msgSender & "|||" & msgDate & "|||" & msgRead & "|||" & msgFlagged
          set msgCount to msgCount + 1
        end if
      end try
    end repeat
    return outputText
  `;

  try {
    if (account) {
      const output = await runAppleScript(accountScript(account, cmd));
      return parseMessageList(output, mailbox, account);
    }
    // No account: use first available account
    const firstAccount = await getFirstAccount();
    if (!firstAccount) return [];
    const output = await runAppleScript(accountScript(firstAccount, cmd));
    return parseMessageList(output, mailbox, firstAccount);
  } catch (error) {
    console.error("listMessages error:", error);
    return [];
  }
}

export async function getMessage(id: string): Promise<MessageContent | null> {
  validateId(id);
  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            set msgSubject to subject of msg
            set msgContent to content of msg
            set htmlContent to ""
            try
              set htmlContent to source of msg
            end try
            return msgSubject & "|||CONTENT|||" & msgContent & "|||HTML|||" & htmlContent
          end if
        end try
      end repeat
    end repeat
    return ""
  on error
    return ""
  end try`);

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return null;
    const htmlSplit = raw.split("|||HTML|||");
    const contentPart = htmlSplit[0];
    // Re-join tail parts in case the message body itself contains the delimiter
    const htmlContent = htmlSplit.length > 1 ? htmlSplit.slice(1).join("|||HTML|||") : undefined;
    const parts = contentPart.split("|||CONTENT|||");
    if (parts.length < 2) return null;
    return { id, subject: parts[0], plainText: parts.slice(1).join("|||CONTENT|||"), htmlContent };
  } catch (error) {
    console.error("getMessage error:", error);
    return null;
  }
}

export async function getUnreadCount(params: {
  mailbox?: string;
  account?: string;
}): Promise<number> {
  const { mailbox, account } = params;

  let cmd: string;
  if (mailbox) {
    cmd = `return unread count of mailbox "${escapeAS(mailbox)}"`;
  } else {
    cmd = `
      set total to 0
      repeat with mb in mailboxes
        set total to total + (unread count of mb)
      end repeat
      return total
    `;
  }

  try {
    let raw: string;
    if (account) {
      raw = await runAppleScript(accountScript(account, cmd));
    } else {
      const firstAccount = await getFirstAccount();
      if (!firstAccount) return 0;
      raw = await runAppleScript(accountScript(firstAccount, cmd));
    }
    return parseInt(raw) || 0;
  } catch (error) {
    console.error("getUnreadCount error:", error);
    return 0;
  }
}

export async function sendEmail(params: {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  account?: string;
  isHtml?: boolean;
  attachments?: string[];
}): Promise<boolean> {
  // isHtml is accepted for API compatibility; Apple Mail's AppleScript interface
  // only supports plain text content for outgoing messages.
  const { to, subject, body, cc, bcc, account, attachments } = params;
  if (!to || to.length === 0) throw new Error("At least one recipient is required");

  // Validate attachment paths
  if (attachments) {
    const { isAbsolute } = await import("path");
    const { existsSync } = await import("fs");
    for (const p of attachments) {
      if (!isAbsolute(p)) throw new Error(`Attachment path must be absolute: "${p}"`);
      if (!existsSync(p)) throw new Error(`Attachment file not found: "${p}"`);
    }
  }

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

  const attachCmds = attachments
    ? attachments
        .map(p => `make new attachment with properties {file name:POSIX file "${escapeAS(p)}"} at after the last paragraph`)
        .join("\n")
    : "";

  // `account` must be a full email address (e.g. "you@example.com") — it sets
  // the From header string via AppleScript's `sender` property. Mail.app routes
  // the message using its own account-matching rules on that address.
  const senderLine = account ? `set sender to "${escapeAS(account)}"` : "";

  const script = appScript(`
    set newMessage to make new outgoing message with properties {subject:"${safeSubject}", content:"${safeBody}", visible:true}
    tell newMessage
      ${recipientCmds}
      ${senderLine}
      ${attachCmds}
    end tell
    send newMessage
    return "sent"`);

  try {
    const raw = await runAppleScript(script);
    return raw.includes("sent");
  } catch (error) {
    console.error("sendEmail error:", error);
    return false;
  }
}

export default {
  searchMessages,
  listMessages,
  getMessage,
  getUnreadCount,
  sendEmail,
  escapeAS,
  parseASDate,
  validateId,
  findMsgScript,
};
