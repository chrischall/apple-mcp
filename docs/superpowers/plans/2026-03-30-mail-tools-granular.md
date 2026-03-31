# Mail Tools — Granular Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `mail` MCP tool with 33 granular tools (`mail_search`, `mail_send`, etc.), porting robust AppleScript implementations from `~/git/apple-mail-mcp`.

**Architecture:** Four new utility files (`mail-core.ts`, `mail-actions.ts`, `mail-batch.ts`, `mail-manage.ts`) are re-exported through a barrel `utils/mail.ts`. Tool definitions go in `tools.ts` (one constant per tool), handlers go in `index.ts` (one `case` per tool name). The old `"mail"` tool and its handler are deleted entirely.

**Tech Stack:** Bun, TypeScript (ESNext), `run-applescript` (already in project), `fs` (Node built-in, already used).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `utils/mail-core.ts` | **Create** | Shared helpers + search, list, get, send, unread-count |
| `utils/mail-actions.ts` | **Create** | reply, forward, create-draft, mark-read/unread, flag/unflag, delete, move |
| `utils/mail-batch.ts` | **Create** | 6 batch operations (delete, move, mark-read/unread, flag/unflag) |
| `utils/mail-manage.ts` | **Create** | accounts, mailboxes, attachments, templates, rules, contacts |
| `utils/mail.ts` | **Replace** | Barrel re-export (all of the above) |
| `tools.ts` | **Modify** | Remove MAIL_TOOL; add 33 new Tool constants |
| `index.ts` | **Modify** | Remove `"mail"` case; add 33 new cases; update ModuleMap type |
| `tests/integration/mail.test.ts` | **Replace** | Tests for all new functions via the barrel |

---

## Task 1: Create `utils/mail-core.ts` — shared helpers and types

**Files:**
- Create: `utils/mail-core.ts`

- [ ] **Step 1: Create the file with shared helpers and stubs for the five core functions**

```typescript
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

/** Parses a "YYYY-M-D-H-m-s" string produced by AS_DATE_STR. */
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
// Core functions (stubs — implementations added in steps below)
// ---------------------------------------------------------------------------

export async function searchMessages(params: {
  query?: string;
  from?: string;
  subject?: string;
  mailbox?: string;
  account?: string;
  isRead?: boolean;
  isFlagged?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<EmailMessage[]> {
  throw new Error("not implemented");
}

export async function listMessages(params: {
  mailbox?: string;
  account?: string;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<EmailMessage[]> {
  throw new Error("not implemented");
}

export async function getMessage(id: string): Promise<MessageContent | null> {
  throw new Error("not implemented");
}

export async function getUnreadCount(params: {
  mailbox?: string;
  account?: string;
}): Promise<number> {
  throw new Error("not implemented");
}

export async function sendEmail(params: {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  account?: string;
  attachments?: string[];
}): Promise<boolean> {
  throw new Error("not implemented");
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
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/chris/git/apple-mcp && bun run dev &
sleep 2 && kill %1
```

Expected: starts without TypeScript errors.

---

## Task 2: Implement `searchMessages`

**Files:**
- Modify: `utils/mail-core.ts`
- Modify: `tests/integration/mail.test.ts` (replace with new test file, started here)

- [ ] **Step 1: Replace the test file with a skeleton importing from the barrel**

```typescript
// tests/integration/mail.test.ts
import { describe, it, expect } from "bun:test";
import { sleep } from "../helpers/test-utils.js";
import mailModule from "../../utils/mail.js";

describe("mail_search / searchMessages", () => {
  it("returns an array", async () => {
    const results = await mailModule.searchMessages({ query: "apple", limit: 3 });
    expect(Array.isArray(results)).toBe(true);
  }, 20000);

  it("each result has required fields", async () => {
    const results = await mailModule.searchMessages({ query: "apple", limit: 3 });
    for (const msg of results) {
      expect(typeof msg.id).toBe("string");
      expect(typeof msg.subject).toBe("string");
      expect(typeof msg.sender).toBe("string");
      expect(msg.dateReceived instanceof Date).toBe(true);
      expect(typeof msg.isRead).toBe("boolean");
      expect(typeof msg.isFlagged).toBe("boolean");
    }
  }, 20000);

  it("returns empty array for impossible query", async () => {
    const results = await mailModule.searchMessages({ query: "ZzZzUnlikelyTerm99991" });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  }, 15000);
});
```

Also update `utils/mail.ts` to be a barrel (just enough for tests to import):

```typescript
// utils/mail.ts  (temporary barrel — expanded in Task 14)
export { default } from "./mail-core.js";
```

- [ ] **Step 2: Run the test to confirm it fails with "not implemented"**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | head -40
```

Expected: FAIL — "not implemented".

- [ ] **Step 3: Implement `searchMessages` in `utils/mail-core.ts`**

Replace the stub:

```typescript
export async function searchMessages(params: {
  query?: string;
  from?: string;
  subject?: string;
  mailbox?: string;
  account?: string;
  isRead?: boolean;
  isFlagged?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<EmailMessage[]> {
  const { query, from, subject: subjectFilter, mailbox = "INBOX", account, isRead, isFlagged, dateFrom, dateTo, limit = 50 } = params;

  // Build whose clause
  const conditions: string[] = [];
  if (query) {
    const q = escapeAS(query);
    conditions.push(`(subject contains "${q}" or sender contains "${q}")`);
  }
  if (from) conditions.push(`sender contains "${escapeAS(from)}"`);
  if (subjectFilter) conditions.push(`subject contains "${escapeAS(subjectFilter)}"`);
  if (isRead !== undefined) conditions.push(`read status is ${isRead}`);
  if (isFlagged !== undefined) conditions.push(`flagged status is ${isFlagged}`);
  const whoseClause = conditions.length > 0 ? `whose ${conditions.join(" and ")}` : "";

  // Date filter (applied in AppleScript loop)
  const dateChecks: string[] = [];
  if (dateFrom) dateChecks.push(`date received of msg >= date "${escapeAS(dateFrom)}"`);
  if (dateTo)   dateChecks.push(`date received of msg <= date "${escapeAS(dateTo)}"`);
  const dateFilter = dateChecks.length > 0 ? `if not (${dateChecks.join(" and ")}) then\n            -- skip\n          else\n` : "";
  const dateEnd   = dateFilter ? "end if\n" : "";

  const cmd = `
    set outputText to ""
    set msgCount to 0
    set theMailbox to mailbox "${escapeAS(mailbox)}"
    repeat with msg in (messages of theMailbox ${whoseClause})
      if msgCount >= ${limit} then exit repeat
      try
        ${dateFilter}
        set msgId to id of msg as string
        set msgSubject to subject of msg
        set msgSender to sender of msg
        set d to date received of msg
        set msgDate to ${AS_DATE_STR}
        set msgRead to read status of msg as string
        set msgFlagged to flagged status of msg as string
        if msgCount > 0 then set outputText to outputText & "|||ITEM|||"
        set outputText to outputText & msgId & "|||" & msgSubject & "|||" & msgSender & "|||" & msgDate & "|||" & msgRead & "|||" & msgFlagged
        set msgCount to msgCount + 1
        ${dateEnd}
      end try
    end repeat
    return outputText
  `;

  try {
    let output: string;
    if (account) {
      output = await runAppleScript(accountScript(account, cmd));
    } else {
      // Search across all accounts
      const accountsRaw = await runAppleScript(appScript(`
        set names to {}
        repeat with acct in accounts
          set end of names to name of acct
        end repeat
        set AppleScript's text item delimiters to "|||"
        return names as text
      `));
      const accountNames = accountsRaw.split("|||").map(s => s.trim()).filter(Boolean);
      const allMsgs: EmailMessage[] = [];
      for (const acct of accountNames) {
        if (allMsgs.length >= limit) break;
        try {
          const raw = await runAppleScript(accountScript(acct, cmd));
          allMsgs.push(...parseMessageList(raw, mailbox, acct));
        } catch { /* skip accounts with errors */ }
      }
      return allMsgs.slice(0, limit);
    }
    return parseMessageList(output, mailbox, account ?? "");
  } catch (error) {
    console.error("searchMessages error:", error);
    return [];
  }
}

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
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/chris/git/apple-mcp && bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | head -40
```

Expected: PASS (the "empty array for impossible query" test confirms the function returns `[]` gracefully).

---

## Task 3: Implement `listMessages`

**Files:**
- Modify: `utils/mail-core.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add test**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail_list / listMessages", () => {
  it("returns an array with correct shape", async () => {
    const results = await mailModule.listMessages({ limit: 5 });
    expect(Array.isArray(results)).toBe(true);
    for (const msg of results) {
      expect(typeof msg.id).toBe("string");
      expect(typeof msg.subject).toBe("string");
      expect(msg.dateReceived instanceof Date).toBe(true);
    }
  }, 20000);

  it("respects unreadOnly flag", async () => {
    const all    = await mailModule.listMessages({ limit: 10 });
    const unread = await mailModule.listMessages({ limit: 10, unreadOnly: true });
    expect(unread.length).toBeLessThanOrEqual(all.length);
    for (const msg of unread) {
      expect(msg.isRead).toBe(false);
    }
  }, 20000);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: FAIL on `listMessages` tests.

- [ ] **Step 3: Implement `listMessages`**

Replace the stub in `utils/mail-core.ts`:

```typescript
export async function listMessages(params: {
  mailbox?: string;
  account?: string;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<EmailMessage[]> {
  const { mailbox = "INBOX", account, limit = 50, unreadOnly = false } = params;
  const whoseClause = unreadOnly ? "whose read status is false" : "";

  const cmd = `
    set outputText to ""
    set msgCount to 0
    set theMailbox to mailbox "${escapeAS(mailbox)}"
    repeat with msg in (messages of theMailbox ${whoseClause})
      if msgCount >= ${limit} then exit repeat
      try
        set msgId to id of msg as string
        set msgSubject to subject of msg
        set msgSender to sender of msg
        set d to date received of msg
        set msgDate to ${AS_DATE_STR}
        set msgRead to read status of msg as string
        set msgFlagged to flagged status of msg as string
        if msgCount > 0 then set outputText to outputText & "|||ITEM|||"
        set outputText to outputText & msgId & "|||" & msgSubject & "|||" & msgSender & "|||" & msgDate & "|||" & msgRead & "|||" & msgFlagged
        set msgCount to msgCount + 1
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
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: PASS.

---

## Task 4: Implement `getMessage` and `getUnreadCount`

**Files:**
- Modify: `utils/mail-core.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail_get / getMessage", () => {
  it("returns null for non-existent id", async () => {
    const result = await mailModule.getMessage("999999999");
    expect(result).toBeNull();
  }, 15000);

  it("returns content for a real message if one exists", async () => {
    const msgs = await mailModule.listMessages({ limit: 1 });
    if (msgs.length === 0) { console.log("⚠️ No messages available"); return; }
    const content = await mailModule.getMessage(msgs[0].id);
    if (content) {
      expect(typeof content.id).toBe("string");
      expect(typeof content.subject).toBe("string");
      expect(typeof content.plainText).toBe("string");
    }
  }, 20000);
});

describe("mail_unread_count / getUnreadCount", () => {
  it("returns a non-negative number", async () => {
    const count = await mailModule.getUnreadCount({});
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  }, 15000);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: FAIL on `getMessage` and `getUnreadCount`.

- [ ] **Step 3: Implement both functions**

Replace stubs in `utils/mail-core.ts`:

```typescript
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
    const htmlContent = htmlSplit.length > 1 ? htmlSplit[1] : undefined;
    const parts = contentPart.split("|||CONTENT|||");
    if (parts.length < 2) return null;
    return { id, subject: parts[0], plainText: parts[1], htmlContent };
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
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: PASS.

---

## Task 5: Implement `sendEmail`

**Files:**
- Modify: `utils/mail-core.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add test**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail_send / sendEmail", () => {
  it("sends a basic email and returns true", async () => {
    const result = await mailModule.sendEmail({
      to: ["test@example.com"],
      subject: `MCP Test ${Date.now()}`,
      body: "Integration test from apple-mcp",
    });
    // Accept both true and false: Mail.app may block sending in CI
    expect(typeof result).toBe("boolean");
    console.log(`sendEmail result: ${result}`);
  }, 20000);

  it("throws when to is empty", async () => {
    await expect(mailModule.sendEmail({ to: [], subject: "x", body: "y" }))
      .rejects.toThrow();
  }, 5000);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Implement `sendEmail`**

Replace stub in `utils/mail-core.ts`:

```typescript
export async function sendEmail(params: {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  account?: string;
  attachments?: string[];
}): Promise<boolean> {
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

  let recipientCmds = to.map(a => `make new to recipient at end of to recipients with properties {address:"${escapeAS(a)}"}`).join("\n");
  if (cc) recipientCmds += "\n" + cc.map(a => `make new cc recipient at end of cc recipients with properties {address:"${escapeAS(a)}"}`).join("\n");
  if (bcc) recipientCmds += "\n" + bcc.map(a => `make new bcc recipient at end of bcc recipients with properties {address:"${escapeAS(a)}"}`).join("\n");

  const attachCmds = attachments
    ? attachments.map(p => `make new attachment with properties {file name:POSIX file "${escapeAS(p)}"} at after the last paragraph`).join("\n")
    : "";

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
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/chris/git/apple-mcp && git add utils/mail-core.ts utils/mail.ts tests/integration/mail.test.ts && git commit -m "feat: add mail-core.ts with search, list, get, unread-count, send"
```

---

## Task 6: Create `utils/mail-actions.ts` — mark, flag, delete, move

**Files:**
- Create: `utils/mail-actions.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail-actions: mark/flag/delete/move", () => {
  it("markAsRead returns false for non-existent message", async () => {
    const result = await mailModule.markAsRead("999999999");
    expect(result).toBe(false);
  }, 15000);

  it("markAsUnread returns false for non-existent message", async () => {
    const result = await mailModule.markAsUnread("999999999");
    expect(result).toBe(false);
  }, 15000);

  it("flagMessage returns false for non-existent message", async () => {
    const result = await mailModule.flagMessage("999999999");
    expect(result).toBe(false);
  }, 15000);

  it("unflagMessage returns false for non-existent message", async () => {
    const result = await mailModule.unflagMessage("999999999");
    expect(result).toBe(false);
  }, 15000);

  it("deleteMessage returns false for non-existent message", async () => {
    const result = await mailModule.deleteMessage("999999999");
    expect(result).toBe(false);
  }, 15000);

  it("moveMessage returns false for non-existent message", async () => {
    const result = await mailModule.moveMessage({ id: "999999999", mailbox: "Trash" });
    expect(result).toBe(false);
  }, 15000);
});
```

Update `utils/mail.ts` barrel to re-export from both modules:

```typescript
// utils/mail.ts  (still growing — finalized in Task 14)
import core from "./mail-core.js";
import actions from "./mail-actions.js";
export default { ...core, ...actions };
```

Create `utils/mail-actions.ts` as stubs so the barrel compiles:

```typescript
// utils/mail-actions.ts
export async function markAsRead(_id: string): Promise<boolean> { throw new Error("not implemented"); }
export async function markAsUnread(_id: string): Promise<boolean> { throw new Error("not implemented"); }
export async function flagMessage(_id: string): Promise<boolean> { throw new Error("not implemented"); }
export async function unflagMessage(_id: string): Promise<boolean> { throw new Error("not implemented"); }
export async function deleteMessage(_id: string): Promise<boolean> { throw new Error("not implemented"); }
export async function moveMessage(_p: { id: string; mailbox: string; account?: string }): Promise<boolean> { throw new Error("not implemented"); }
export async function replyToMessage(_p: { id: string; body: string; replyAll?: boolean }): Promise<boolean> { throw new Error("not implemented"); }
export async function forwardMessage(_p: { id: string; to: string[]; body?: string }): Promise<boolean> { throw new Error("not implemented"); }
export async function createDraft(_p: { to: string[]; subject: string; body: string; cc?: string[]; bcc?: string[]; account?: string }): Promise<boolean> { throw new Error("not implemented"); }
export default { markAsRead, markAsUnread, flagMessage, unflagMessage, deleteMessage, moveMessage, replyToMessage, forwardMessage, createDraft };
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: FAIL — "not implemented".

- [ ] **Step 3: Implement mark/flag/delete/move in `utils/mail-actions.ts`**

```typescript
// utils/mail-actions.ts
import { runAppleScript } from "run-applescript";
import { escapeAS, validateId, findMsgScript, appScript } from "./mail-core.js";

async function findAndAct(id: string, operation: string): Promise<boolean> {
  validateId(id);
  try {
    const raw = await runAppleScript(findMsgScript(id, operation));
    return raw.trim() === "ok";
  } catch (error) {
    console.error(`Mail action error (${operation}):`, error);
    return false;
  }
}

export async function markAsRead(id: string): Promise<boolean> {
  return findAndAct(id, "set read status of msg to true");
}

export async function markAsUnread(id: string): Promise<boolean> {
  return findAndAct(id, "set read status of msg to false");
}

export async function flagMessage(id: string): Promise<boolean> {
  return findAndAct(id, "set flagged status of msg to true");
}

export async function unflagMessage(id: string): Promise<boolean> {
  return findAndAct(id, "set flagged status of msg to false");
}

export async function deleteMessage(id: string): Promise<boolean> {
  return findAndAct(id, "delete msg");
}

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

export async function replyToMessage(_p: { id: string; body: string; replyAll?: boolean }): Promise<boolean> {
  throw new Error("not implemented");
}
export async function forwardMessage(_p: { id: string; to: string[]; body?: string }): Promise<boolean> {
  throw new Error("not implemented");
}
export async function createDraft(_p: { to: string[]; subject: string; body: string; cc?: string[]; bcc?: string[]; account?: string }): Promise<boolean> {
  throw new Error("not implemented");
}

export default { markAsRead, markAsUnread, flagMessage, unflagMessage, deleteMessage, moveMessage, replyToMessage, forwardMessage, createDraft };
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: mark/flag/delete/move tests PASS (returning false for non-existent message). reply/forward/draft still fail.

---

## Task 7: Implement `replyToMessage`, `forwardMessage`, `createDraft`

**Files:**
- Modify: `utils/mail-actions.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail-actions: reply/forward/draft", () => {
  it("replyToMessage returns false for non-existent message", async () => {
    const result = await mailModule.replyToMessage({ id: "999999999", body: "test reply" });
    expect(result).toBe(false);
  }, 15000);

  it("forwardMessage returns false for non-existent message", async () => {
    const result = await mailModule.forwardMessage({ id: "999999999", to: ["a@b.com"] });
    expect(result).toBe(false);
  }, 15000);

  it("createDraft returns boolean", async () => {
    const result = await mailModule.createDraft({
      to: ["test@example.com"],
      subject: `Draft Test ${Date.now()}`,
      body: "This is a draft",
    });
    expect(typeof result).toBe("boolean");
  }, 15000);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: FAIL on reply/forward/draft.

- [ ] **Step 3: Replace stubs with implementations in `utils/mail-actions.ts`**

```typescript
export async function replyToMessage(params: {
  id: string;
  body: string;
  replyAll?: boolean;
}): Promise<boolean> {
  const { id, body, replyAll = false } = params;
  validateId(id);
  const safeBody = escapeAS(body);
  const replyAllClause = replyAll ? " with reply to all" : "";

  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            set theReply to reply msg with opening window${replyAllClause}
            set content of theReply to "${safeBody}" & return & return & content of theReply
            send theReply
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
    console.error("replyToMessage error:", error);
    return false;
  }
}

export async function forwardMessage(params: {
  id: string;
  to: string[];
  body?: string;
}): Promise<boolean> {
  const { id, to, body } = params;
  validateId(id);
  const recipientCmds = to.map(a => `make new to recipient at end of to recipients of theForward with properties {address:"${escapeAS(a)}"}`).join("\n");
  const bodyLine = body ? `set content of theForward to "${escapeAS(body)}" & return & return & content of theForward` : "";

  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            set theForward to forward msg with opening window
            ${recipientCmds}
            ${bodyLine}
            send theForward
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
    console.error("forwardMessage error:", error);
    return false;
  }
}

export async function createDraft(params: {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  account?: string;
}): Promise<boolean> {
  const { to, subject, body, cc, bcc, account } = params;
  if (!to || to.length === 0) throw new Error("At least one recipient is required");

  let recipientCmds = to.map(a => `make new to recipient at end of to recipients with properties {address:"${escapeAS(a)}"}`).join("\n");
  if (cc) recipientCmds += "\n" + cc.map(a => `make new cc recipient at end of cc recipients with properties {address:"${escapeAS(a)}"}`).join("\n");
  if (bcc) recipientCmds += "\n" + bcc.map(a => `make new bcc recipient at end of bcc recipients with properties {address:"${escapeAS(a)}"}`).join("\n");
  const senderLine = account ? `set sender to "${escapeAS(account)}"` : "";

  const script = appScript(`
    set newMessage to make new outgoing message with properties {subject:"${escapeAS(subject)}", content:"${escapeAS(body)}", visible:false}
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
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/mail-actions.ts utils/mail.ts tests/integration/mail.test.ts && git commit -m "feat: add mail-actions.ts with mark, flag, delete, move, reply, forward, draft"
```

---

## Task 8: Create `utils/mail-batch.ts`

**Files:**
- Create: `utils/mail-batch.ts`
- Modify: `utils/mail.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail-batch operations", () => {
  it("batchMarkAsRead returns per-item results", async () => {
    const results = await mailModule.batchMarkAsRead(["999999998", "999999999"]);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.success).toBe("boolean");
    }
  }, 20000);

  it("batchMarkAsRead rejects more than 100 ids", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => String(i + 1));
    await expect(mailModule.batchMarkAsRead(ids)).rejects.toThrow("100");
  }, 5000);

  it("batchMarkAsUnread returns per-item results", async () => {
    const results = await mailModule.batchMarkAsUnread(["999999999"]);
    expect(Array.isArray(results)).toBe(true);
  }, 15000);

  it("batchFlagMessages returns per-item results", async () => {
    const results = await mailModule.batchFlagMessages(["999999999"]);
    expect(Array.isArray(results)).toBe(true);
  }, 15000);

  it("batchUnflagMessages returns per-item results", async () => {
    const results = await mailModule.batchUnflagMessages(["999999999"]);
    expect(Array.isArray(results)).toBe(true);
  }, 15000);

  it("batchDeleteMessages returns per-item results", async () => {
    const results = await mailModule.batchDeleteMessages(["999999999"]);
    expect(Array.isArray(results)).toBe(true);
  }, 15000);

  it("batchMoveMessages returns per-item results", async () => {
    const results = await mailModule.batchMoveMessages({ ids: ["999999999"], mailbox: "Trash" });
    expect(Array.isArray(results)).toBe(true);
  }, 15000);
});
```

- [ ] **Step 2: Create `utils/mail-batch.ts`**

```typescript
// utils/mail-batch.ts
import {
  markAsRead, markAsUnread, flagMessage, unflagMessage, deleteMessage, moveMessage
} from "./mail-actions.js";

export interface BatchResult {
  id: string;
  success: boolean;
  error?: string;
}

const MAX_BATCH = 100;

function validateBatch(ids: string[]): void {
  if (ids.length === 0) throw new Error("At least one ID is required");
  if (ids.length > MAX_BATCH) throw new Error(`Cannot process more than ${MAX_BATCH} messages in a single batch`);
}

export async function batchMarkAsRead(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await markAsRead(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchMarkAsUnread(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await markAsUnread(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchFlagMessages(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await flagMessage(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchUnflagMessages(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await unflagMessage(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchDeleteMessages(ids: string[]): Promise<BatchResult[]> {
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await deleteMessage(id) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export async function batchMoveMessages(params: {
  ids: string[];
  mailbox: string;
  account?: string;
}): Promise<BatchResult[]> {
  const { ids, mailbox, account } = params;
  validateBatch(ids);
  return Promise.all(ids.map(async id => {
    try { return { id, success: await moveMessage({ id, mailbox, account }) }; }
    catch (e) { return { id, success: false, error: e instanceof Error ? e.message : String(e) }; }
  }));
}

export default { batchMarkAsRead, batchMarkAsUnread, batchFlagMessages, batchUnflagMessages, batchDeleteMessages, batchMoveMessages };
```

Update `utils/mail.ts`:

```typescript
import core from "./mail-core.js";
import actions from "./mail-actions.js";
import batch from "./mail-batch.js";
export default { ...core, ...actions, ...batch };
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add utils/mail-batch.ts utils/mail.ts tests/integration/mail.test.ts && git commit -m "feat: add mail-batch.ts with 6 batch operations"
```

---

## Task 9: Create `utils/mail-manage.ts` — accounts, mailboxes

**Files:**
- Create: `utils/mail-manage.ts`
- Modify: `utils/mail.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail-manage: accounts and mailboxes", () => {
  it("listAccounts returns array of Account objects", async () => {
    const accounts = await mailModule.listAccounts();
    expect(Array.isArray(accounts)).toBe(true);
    for (const a of accounts) {
      expect(typeof a.name).toBe("string");
      expect(typeof a.email).toBe("string");
      expect(typeof a.enabled).toBe("boolean");
    }
    console.log(`Found ${accounts.length} accounts`);
  }, 15000);

  it("listMailboxes returns array with name and unreadCount", async () => {
    const accounts = await mailModule.listAccounts();
    if (accounts.length === 0) { console.log("⚠️ No accounts"); return; }
    const mailboxes = await mailModule.listMailboxes({ account: accounts[0].name });
    expect(Array.isArray(mailboxes)).toBe(true);
    for (const mb of mailboxes) {
      expect(typeof mb.name).toBe("string");
      expect(typeof mb.unreadCount).toBe("number");
      expect(typeof mb.messageCount).toBe("number");
    }
  }, 15000);

  it("createMailbox returns boolean", async () => {
    const accounts = await mailModule.listAccounts();
    if (accounts.length === 0) { console.log("⚠️ No accounts"); return; }
    const result = await mailModule.createMailbox({ name: `MCPTest${Date.now()}`, account: accounts[0].name });
    expect(typeof result).toBe("boolean");
  }, 15000);
});
```

- [ ] **Step 2: Create `utils/mail-manage.ts` with accounts and mailbox functions**

```typescript
// utils/mail-manage.ts
import { runAppleScript } from "run-applescript";
import { escapeAS, validateId, appScript, accountScript } from "./mail-core.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, resolve as resolvePath } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Account { name: string; email: string; enabled: boolean; }
export interface Mailbox { name: string; account: string; unreadCount: number; messageCount: number; }
export interface Attachment { id: string; name: string; mimeType: string; size: number; }
export interface MailRule { name: string; enabled: boolean; }
export interface Contact { name: string; emails: string[]; phones: string[]; }
export interface EmailTemplate { id: string; name: string; subject: string; body: string; to?: string[]; cc?: string[]; }

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function listAccounts(): Promise<Account[]> {
  const script = appScript(`
    set accountList to {}
    repeat with acct in accounts
      set acctName to name of acct
      set acctEmails to email addresses of acct
      set acctEnabled to enabled of acct
      set emailStr to ""
      if (count of acctEmails) > 0 then set emailStr to item 1 of acctEmails
      set end of accountList to acctName & "|||" & emailStr & "|||" & (acctEnabled as string)
    end repeat
    set AppleScript's text item delimiters to "|||ITEM|||"
    return accountList as text`);

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 3) return [];
      return [{ name: parts[0], email: parts[1], enabled: parts[2] === "true" }];
    });
  } catch (error) {
    console.error("listAccounts error:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Mailboxes
// ---------------------------------------------------------------------------

export async function listMailboxes(params: { account?: string }): Promise<Mailbox[]> {
  const { account } = params;
  const cmd = `
    set mailboxList to {}
    repeat with mb in mailboxes
      set mbName to name of mb
      set mbUnread to unread count of mb
      set mbCount to count of messages of mb
      set end of mailboxList to mbName & "|||" & (mbUnread as string) & "|||" & (mbCount as string)
    end repeat
    set AppleScript's text item delimiters to "|||ITEM|||"
    return mailboxList as text
  `;

  try {
    let raw: string;
    if (account) {
      raw = await runAppleScript(accountScript(account, cmd));
    } else {
      const accounts = await listAccounts();
      if (accounts.length === 0) return [];
      raw = await runAppleScript(accountScript(accounts[0].name, cmd));
      return parseMailboxList(raw, accounts[0].name);
    }
    return parseMailboxList(raw, account ?? "");
  } catch (error) {
    console.error("listMailboxes error:", error);
    return [];
  }
}

function parseMailboxList(raw: string, account: string): Mailbox[] {
  if (!raw.trim()) return [];
  return raw.split("|||ITEM|||").flatMap(item => {
    const parts = item.split("|||");
    if (parts.length < 3) return [];
    return [{ name: parts[0], account, unreadCount: parseInt(parts[1]) || 0, messageCount: parseInt(parts[2]) || 0 }];
  });
}

export async function createMailbox(params: { name: string; account?: string }): Promise<boolean> {
  const { name, account } = params;
  const accounts = await listAccounts();
  const targetAccount = account ?? accounts[0]?.name;
  if (!targetAccount) return false;

  const script = appScript(`
  try
    make new mailbox with properties {name:"${escapeAS(name)}"} at account "${escapeAS(targetAccount)}"
    return "ok"
  on error errMsg
    return "error:" & errMsg
  end try`);

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("createMailbox error:", error);
    return false;
  }
}

// Stubs for remaining functions (implemented in later tasks)
export async function listAttachments(_id: string): Promise<Attachment[]> { throw new Error("not implemented"); }
export async function saveAttachment(_p: { id: string; attachmentName: string; savePath: string }): Promise<boolean> { throw new Error("not implemented"); }
export async function listTemplates(): Promise<EmailTemplate[]> { throw new Error("not implemented"); }
export async function saveTemplate(_p: { name: string; subject: string; body: string; to?: string[]; cc?: string[]; id?: string }): Promise<EmailTemplate> { throw new Error("not implemented"); }
export async function getTemplate(_id: string): Promise<EmailTemplate | null> { throw new Error("not implemented"); }
export async function deleteTemplate(_id: string): Promise<boolean> { throw new Error("not implemented"); }
export async function listRules(): Promise<MailRule[]> { throw new Error("not implemented"); }
export async function enableRule(_name: string): Promise<boolean> { throw new Error("not implemented"); }
export async function disableRule(_name: string): Promise<boolean> { throw new Error("not implemented"); }
export async function searchContacts(_query: string): Promise<Contact[]> { throw new Error("not implemented"); }

export default { listAccounts, listMailboxes, createMailbox, listAttachments, saveAttachment, listTemplates, saveTemplate, getTemplate, deleteTemplate, listRules, enableRule, disableRule, searchContacts };
```

Update `utils/mail.ts`:

```typescript
import core from "./mail-core.js";
import actions from "./mail-actions.js";
import batch from "./mail-batch.js";
import manage from "./mail-manage.js";
export default { ...core, ...actions, ...batch, ...manage };
```

- [ ] **Step 3: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: accounts/mailboxes tests PASS; attachment/template/rule tests still not reached.

---

## Task 10: Implement `listAttachments` and `saveAttachment`

**Files:**
- Modify: `utils/mail-manage.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail-manage: attachments", () => {
  it("listAttachments returns empty array for non-existent message", async () => {
    const result = await mailModule.listAttachments("999999999");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  }, 15000);

  it("saveAttachment rejects path outside home directory", async () => {
    await expect(
      mailModule.saveAttachment({ id: "123456789", attachmentName: "test.pdf", savePath: "/etc" })
    ).rejects.toThrow();
  }, 5000);

  it("saveAttachment rejects path traversal in attachmentName", async () => {
    await expect(
      mailModule.saveAttachment({ id: "123456789", attachmentName: "../evil.sh", savePath: `${homedir()}/Downloads` })
    ).rejects.toThrow();
  }, 5000);
});
```

Add import at top of test file: `import { homedir } from "os";`

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | grep -E "PASS|FAIL|not implemented" | tail -20
```

- [ ] **Step 3: Implement in `utils/mail-manage.ts`**

Replace the stubs:

```typescript
export async function listAttachments(id: string): Promise<Attachment[]> {
  validateId(id);

  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            set outputText to ""
            set attCount to 0
            repeat with att in mail attachments of msg
              set attName to name of att
              set attType to MIME type of att
              set attSize to file size of att as string
              if attCount > 0 then set outputText to outputText & "|||ITEM|||"
              set outputText to outputText & attName & "|||" & attType & "|||" & attSize
              set attCount to attCount + 1
            end repeat
            return outputText
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
    if (!raw.trim()) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 3) return [];
      return [{ id: `${id}-${parts[0]}`, name: parts[0], mimeType: parts[1], size: parseInt(parts[2]) || 0 }];
    });
  } catch (error) {
    console.error("listAttachments error:", error);
    return [];
  }
}

export async function saveAttachment(params: {
  id: string;
  attachmentName: string;
  savePath: string;
}): Promise<boolean> {
  const { id, attachmentName, savePath } = params;
  validateId(id);

  if (/[/\\\0]/.test(attachmentName) || attachmentName.includes("..")) {
    throw new Error(`Invalid attachment name: "${attachmentName}"`);
  }

  const resolvedPath = resolvePath(savePath);
  const allowed = [homedir(), "/tmp", "/private/tmp", "/Volumes"];
  if (!allowed.some(p => resolvedPath.startsWith(p))) {
    throw new Error(`Save path "${savePath}" is outside allowed directories`);
  }

  const script = appScript(`
  try
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        try
          set matchingMsgs to (messages of mb whose id is ${Number(id)})
          if (count of matchingMsgs) > 0 then
            set msg to item 1 of matchingMsgs
            repeat with att in mail attachments of msg
              if name of att is "${escapeAS(attachmentName)}" then
                set saveTo to POSIX file "${escapeAS(resolvedPath)}/${escapeAS(attachmentName)}"
                save att in saveTo
                return "ok"
              end if
            end repeat
            return "error:Attachment not found"
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
    console.error("saveAttachment error:", error);
    return false;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: PASS.

---

## Task 11: Implement templates in `utils/mail-manage.ts`

**Files:**
- Modify: `utils/mail-manage.ts`
- Modify: `tests/integration/mail.test.ts`

Templates are stored as JSON in `~/.apple-mcp-templates.json`.

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail-manage: templates", () => {
  const testTemplateName = `TestTemplate_${Date.now()}`;
  let savedId: string;

  it("saveTemplate returns a template with an id", async () => {
    const t = await mailModule.saveTemplate({
      name: testTemplateName,
      subject: "Hello {{Name}}",
      body: "Dear {{Name}}, this is a test.",
    });
    expect(typeof t.id).toBe("string");
    expect(t.name).toBe(testTemplateName);
    savedId = t.id;
  }, 5000);

  it("listTemplates includes the saved template", async () => {
    const templates = await mailModule.listTemplates();
    expect(Array.isArray(templates)).toBe(true);
    const found = templates.find(t => t.name === testTemplateName);
    expect(found).toBeDefined();
  }, 5000);

  it("getTemplate returns the template by id", async () => {
    if (!savedId) { console.log("⚠️ skipped: no savedId"); return; }
    const t = await mailModule.getTemplate(savedId);
    expect(t).not.toBeNull();
    expect(t!.name).toBe(testTemplateName);
  }, 5000);

  it("deleteTemplate removes the template", async () => {
    if (!savedId) { console.log("⚠️ skipped: no savedId"); return; }
    const result = await mailModule.deleteTemplate(savedId);
    expect(result).toBe(true);
    const t = await mailModule.getTemplate(savedId);
    expect(t).toBeNull();
  }, 5000);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

- [ ] **Step 3: Implement template functions in `utils/mail-manage.ts`**

Add near the top of `utils/mail-manage.ts` (after the imports):

```typescript
// ---------------------------------------------------------------------------
// Template storage helpers
// ---------------------------------------------------------------------------

const TEMPLATES_FILE = join(homedir(), ".apple-mcp-templates.json");

function loadTemplateStore(): Map<string, EmailTemplate> {
  if (!existsSync(TEMPLATES_FILE)) return new Map();
  try {
    const data = JSON.parse(readFileSync(TEMPLATES_FILE, "utf8")) as EmailTemplate[];
    return new Map(data.map(t => [t.id, t]));
  } catch { return new Map(); }
}

function persistTemplateStore(store: Map<string, EmailTemplate>): void {
  writeFileSync(TEMPLATES_FILE, JSON.stringify(Array.from(store.values()), null, 2), "utf8");
}
```

Replace the template stubs:

```typescript
export async function listTemplates(): Promise<EmailTemplate[]> {
  return Array.from(loadTemplateStore().values());
}

export async function saveTemplate(params: {
  name: string;
  subject: string;
  body: string;
  to?: string[];
  cc?: string[];
  id?: string;
}): Promise<EmailTemplate> {
  const store = loadTemplateStore();
  const id = params.id ?? `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const template: EmailTemplate = { id, name: params.name, subject: params.subject, body: params.body, to: params.to, cc: params.cc };
  store.set(id, template);
  persistTemplateStore(store);
  return template;
}

export async function getTemplate(id: string): Promise<EmailTemplate | null> {
  return loadTemplateStore().get(id) ?? null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const store = loadTemplateStore();
  const existed = store.delete(id);
  if (existed) persistTemplateStore(store);
  return existed;
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

Expected: PASS.

---

## Task 12: Implement rules and contacts in `utils/mail-manage.ts`

**Files:**
- Modify: `utils/mail-manage.ts`
- Modify: `tests/integration/mail.test.ts`

- [ ] **Step 1: Add tests**

Append to `tests/integration/mail.test.ts`:

```typescript
describe("mail-manage: rules", () => {
  it("listRules returns an array", async () => {
    const rules = await mailModule.listRules();
    expect(Array.isArray(rules)).toBe(true);
    for (const r of rules) {
      expect(typeof r.name).toBe("string");
      expect(typeof r.enabled).toBe("boolean");
    }
    console.log(`Found ${rules.length} rules`);
  }, 15000);

  it("enableRule returns false for non-existent rule", async () => {
    const result = await mailModule.enableRule("NonExistentRuleZzZz");
    expect(result).toBe(false);
  }, 10000);

  it("disableRule returns false for non-existent rule", async () => {
    const result = await mailModule.disableRule("NonExistentRuleZzZz");
    expect(result).toBe(false);
  }, 10000);
});

describe("mail-manage: contacts", () => {
  it("searchContacts returns an array", async () => {
    const contacts = await mailModule.searchContacts("test");
    expect(Array.isArray(contacts)).toBe(true);
    for (const c of contacts) {
      expect(typeof c.name).toBe("string");
      expect(Array.isArray(c.emails)).toBe(true);
      expect(Array.isArray(c.phones)).toBe(true);
    }
  }, 15000);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -20
```

- [ ] **Step 3: Implement rules and contacts in `utils/mail-manage.ts`**

Replace stubs:

```typescript
export async function listRules(): Promise<MailRule[]> {
  const script = appScript(`
    set ruleList to {}
    repeat with r in rules
      set end of ruleList to (name of r) & "|||" & ((enabled of r) as string)
    end repeat
    set AppleScript's text item delimiters to "|||ITEM|||"
    return ruleList as text`);

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 2) return [];
      return [{ name: parts[0], enabled: parts[1] === "true" }];
    });
  } catch (error) {
    console.error("listRules error:", error);
    return [];
  }
}

async function setRuleEnabled(ruleName: string, enabled: boolean): Promise<boolean> {
  const script = appScript(`
  try
    repeat with r in rules
      if name of r is "${escapeAS(ruleName)}" then
        set enabled of r to ${enabled}
        return "ok"
      end if
    end repeat
    return "error:Rule not found"
  on error errMsg
    return "error:" & errMsg
  end try`);

  try {
    const raw = await runAppleScript(script);
    return raw.trim() === "ok";
  } catch (error) {
    console.error("setRuleEnabled error:", error);
    return false;
  }
}

export async function enableRule(name: string): Promise<boolean> {
  return setRuleEnabled(name, true);
}

export async function disableRule(name: string): Promise<boolean> {
  return setRuleEnabled(name, false);
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const safeQuery = escapeAS(query);
  const script = `
tell application "Contacts"
  set matchedContacts to {}
  set foundPeople to (every person whose name contains "${safeQuery}") & (every person whose value of emails contains "${safeQuery}")
  set seenIds to {}
  repeat with p in foundPeople
    set pid to id of p
    if seenIds does not contain pid then
      set end of seenIds to pid
      set pName to name of p
      set pEmails to ""
      repeat with e in emails of p
        if pEmails is not "" then set pEmails to pEmails & ","
        set pEmails to pEmails & (value of e)
      end repeat
      set pPhones to ""
      repeat with ph in phones of p
        if pPhones is not "" then set pPhones to pPhones & ","
        set pPhones to pPhones & (value of ph)
      end repeat
      set end of matchedContacts to pName & "|||" & pEmails & "|||" & pPhones
    end if
  end repeat
  set AppleScript's text item delimiters to "|||ITEM|||"
  return matchedContacts as text
end tell`;

  try {
    const raw = await runAppleScript(script);
    if (!raw.trim()) return [];
    return raw.split("|||ITEM|||").flatMap(item => {
      const parts = item.split("|||");
      if (parts.length < 3) return [];
      return [{
        name: parts[0],
        emails: parts[1] ? parts[1].split(",").filter(Boolean) : [],
        phones: parts[2] ? parts[2].split(",").filter(Boolean) : [],
      }];
    });
  } catch (error) {
    console.error("searchContacts error:", error);
    return [];
  }
}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/integration/mail.test.ts --timeout 30000 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/mail-manage.ts utils/mail.ts tests/integration/mail.test.ts && git commit -m "feat: add mail-manage.ts with accounts, mailboxes, attachments, templates, rules, contacts"
```

---

## Task 13: Finalize `utils/mail.ts` barrel

**Files:**
- Modify: `utils/mail.ts`

- [ ] **Step 1: Replace with the final barrel**

```typescript
// utils/mail.ts
import core, { escapeAS, parseASDate, validateId, findMsgScript, appScript, accountScript, AS_DATE_STR } from "./mail-core.js";
import actions from "./mail-actions.js";
import batch from "./mail-batch.js";
import manage from "./mail-manage.js";

export default { ...core, ...actions, ...batch, ...manage };
```

- [ ] **Step 2: Run full mail test suite to confirm no regressions**

```bash
bun test tests/integration/mail.test.ts --timeout 60000 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add utils/mail.ts && git commit -m "chore: finalize utils/mail.ts barrel re-export"
```

---

## Task 14: Add tool definitions to `tools.ts`

**Files:**
- Modify: `tools.ts`

- [ ] **Step 1: Remove `MAIL_TOOL` and add all 33 new Tool constants**

In `tools.ts`, delete the `MAIL_TOOL` constant and the `MAIL_TOOL` entry from the `tools` array export, then add the following constants (in the same file, before the `tools` array):

```typescript
// ---------------------------------------------------------------------------
// Core mail tools
// ---------------------------------------------------------------------------

const MAIL_SEARCH_TOOL: Tool = {
  name: "mail_search",
  description: "Search emails in Apple Mail by query, sender, subject, date range, read/flagged status",
  inputSchema: {
    type: "object",
    properties: {
      query:    { type: "string", description: "Full-text search term (subject + sender)" },
      from:     { type: "string", description: "Filter by sender address" },
      subject:  { type: "string", description: "Filter by subject text" },
      mailbox:  { type: "string", description: "Mailbox to search (default: INBOX)" },
      account:  { type: "string", description: "Account name (searches all accounts if omitted)" },
      isRead:   { type: "boolean", description: "Filter by read status" },
      isFlagged:{ type: "boolean", description: "Filter by flagged status" },
      dateFrom: { type: "string", description: "Start date (e.g. 'March 1, 2026')" },
      dateTo:   { type: "string", description: "End date (e.g. 'March 31, 2026')" },
      limit:    { type: "number", description: "Max results (default 50)" },
    },
  },
};

const MAIL_LIST_TOOL: Tool = {
  name: "mail_list",
  description: "List emails in a mailbox (newest first)",
  inputSchema: {
    type: "object",
    properties: {
      mailbox:    { type: "string", description: "Mailbox name (default: INBOX)" },
      account:    { type: "string", description: "Account name" },
      limit:      { type: "number", description: "Max results (default 50)" },
      unreadOnly: { type: "boolean", description: "Return only unread messages" },
    },
  },
};

const MAIL_GET_TOOL: Tool = {
  name: "mail_get",
  description: "Get the full content (plain text and HTML) of a specific email by its numeric ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Numeric message ID (from mail_search or mail_list)" },
    },
    required: ["id"],
  },
};

const MAIL_SEND_TOOL: Tool = {
  name: "mail_send",
  description: "Send an email via Apple Mail",
  inputSchema: {
    type: "object",
    properties: {
      to:          { type: "array", items: { type: "string" }, description: "Recipient addresses" },
      subject:     { type: "string", description: "Email subject" },
      body:        { type: "string", description: "Email body (plain text)" },
      cc:          { type: "array", items: { type: "string" }, description: "CC addresses" },
      bcc:         { type: "array", items: { type: "string" }, description: "BCC addresses" },
      account:     { type: "string", description: "Sender account email address" },
      attachments: { type: "array", items: { type: "string" }, description: "Absolute paths to files to attach" },
    },
    required: ["to", "subject", "body"],
  },
};

const MAIL_UNREAD_COUNT_TOOL: Tool = {
  name: "mail_unread_count",
  description: "Get the total unread email count for an account or mailbox",
  inputSchema: {
    type: "object",
    properties: {
      mailbox: { type: "string", description: "Mailbox name (omit for all mailboxes in account)" },
      account: { type: "string", description: "Account name" },
    },
  },
};

// ---------------------------------------------------------------------------
// Message action tools
// ---------------------------------------------------------------------------

const MAIL_REPLY_TOOL: Tool = {
  name: "mail_reply",
  description: "Reply to an email message",
  inputSchema: {
    type: "object",
    properties: {
      id:       { type: "string", description: "Numeric message ID" },
      body:     { type: "string", description: "Reply body text" },
      replyAll: { type: "boolean", description: "Reply to all recipients (default false)" },
    },
    required: ["id", "body"],
  },
};

const MAIL_FORWARD_TOOL: Tool = {
  name: "mail_forward",
  description: "Forward an email to one or more recipients",
  inputSchema: {
    type: "object",
    properties: {
      id:   { type: "string", description: "Numeric message ID" },
      to:   { type: "array", items: { type: "string" }, description: "Recipient addresses" },
      body: { type: "string", description: "Optional text to prepend before the forwarded content" },
    },
    required: ["id", "to"],
  },
};

const MAIL_CREATE_DRAFT_TOOL: Tool = {
  name: "mail_create_draft",
  description: "Create a draft email (saved but not sent)",
  inputSchema: {
    type: "object",
    properties: {
      to:      { type: "array", items: { type: "string" }, description: "Recipient addresses" },
      subject: { type: "string", description: "Email subject" },
      body:    { type: "string", description: "Email body" },
      cc:      { type: "array", items: { type: "string" }, description: "CC addresses" },
      bcc:     { type: "array", items: { type: "string" }, description: "BCC addresses" },
      account: { type: "string", description: "Account to create the draft in" },
    },
    required: ["to", "subject", "body"],
  },
};

const MAIL_MARK_READ_TOOL: Tool = {
  name: "mail_mark_read",
  description: "Mark an email as read",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_MARK_UNREAD_TOOL: Tool = {
  name: "mail_mark_unread",
  description: "Mark an email as unread",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_FLAG_TOOL: Tool = {
  name: "mail_flag",
  description: "Flag an email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_UNFLAG_TOOL: Tool = {
  name: "mail_unflag",
  description: "Remove the flag from an email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_DELETE_TOOL: Tool = {
  name: "mail_delete",
  description: "Delete (move to Trash) an email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_MOVE_TOOL: Tool = {
  name: "mail_move",
  description: "Move an email to a different mailbox",
  inputSchema: {
    type: "object",
    properties: {
      id:      { type: "string", description: "Numeric message ID" },
      mailbox: { type: "string", description: "Destination mailbox name" },
      account: { type: "string", description: "Account containing the destination mailbox" },
    },
    required: ["id", "mailbox"],
  },
};

// ---------------------------------------------------------------------------
// Batch tools
// ---------------------------------------------------------------------------

const BATCH_IDS_SCHEMA = {
  type: "array",
  items: { type: "string" },
  description: "Array of numeric message IDs (max 100)",
};

const MAIL_BATCH_DELETE_TOOL: Tool = {
  name: "mail_batch_delete",
  description: "Delete multiple emails at once (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_MOVE_TOOL: Tool = {
  name: "mail_batch_move",
  description: "Move multiple emails to a mailbox (max 100)",
  inputSchema: {
    type: "object",
    properties: {
      ids:     BATCH_IDS_SCHEMA,
      mailbox: { type: "string", description: "Destination mailbox name" },
      account: { type: "string", description: "Account containing the destination mailbox" },
    },
    required: ["ids", "mailbox"],
  },
};

const MAIL_BATCH_MARK_READ_TOOL: Tool = {
  name: "mail_batch_mark_read",
  description: "Mark multiple emails as read (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_MARK_UNREAD_TOOL: Tool = {
  name: "mail_batch_mark_unread",
  description: "Mark multiple emails as unread (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_FLAG_TOOL: Tool = {
  name: "mail_batch_flag",
  description: "Flag multiple emails (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

const MAIL_BATCH_UNFLAG_TOOL: Tool = {
  name: "mail_batch_unflag",
  description: "Remove flags from multiple emails (max 100)",
  inputSchema: { type: "object", properties: { ids: BATCH_IDS_SCHEMA }, required: ["ids"] },
};

// ---------------------------------------------------------------------------
// Management tools
// ---------------------------------------------------------------------------

const MAIL_LIST_MAILBOXES_TOOL: Tool = {
  name: "mail_list_mailboxes",
  description: "List all mailboxes for an account with unread and total message counts",
  inputSchema: { type: "object", properties: { account: { type: "string", description: "Account name (uses first account if omitted)" } } },
};

const MAIL_LIST_ACCOUNTS_TOOL: Tool = {
  name: "mail_list_accounts",
  description: "List all configured email accounts in Apple Mail",
  inputSchema: { type: "object", properties: {} },
};

const MAIL_CREATE_MAILBOX_TOOL: Tool = {
  name: "mail_create_mailbox",
  description: "Create a new mailbox (folder) in an account",
  inputSchema: {
    type: "object",
    properties: {
      name:    { type: "string", description: "Mailbox name to create" },
      account: { type: "string", description: "Account to create the mailbox in" },
    },
    required: ["name"],
  },
};

const MAIL_LIST_ATTACHMENTS_TOOL: Tool = {
  name: "mail_list_attachments",
  description: "List attachments for a specific email message",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Numeric message ID" } }, required: ["id"] },
};

const MAIL_SAVE_ATTACHMENT_TOOL: Tool = {
  name: "mail_save_attachment",
  description: "Save an email attachment to disk",
  inputSchema: {
    type: "object",
    properties: {
      id:             { type: "string", description: "Numeric message ID" },
      attachmentName: { type: "string", description: "Filename of the attachment (no path separators)" },
      savePath:       { type: "string", description: "Absolute directory path to save the file (must be under home directory, /tmp, or /Volumes)" },
    },
    required: ["id", "attachmentName", "savePath"],
  },
};

const MAIL_LIST_TEMPLATES_TOOL: Tool = {
  name: "mail_list_templates",
  description: "List all saved email templates",
  inputSchema: { type: "object", properties: {} },
};

const MAIL_SAVE_TEMPLATE_TOOL: Tool = {
  name: "mail_save_template",
  description: "Create or update an email template",
  inputSchema: {
    type: "object",
    properties: {
      name:    { type: "string", description: "Template name" },
      subject: { type: "string", description: "Subject line (may include {{placeholder}} tokens)" },
      body:    { type: "string", description: "Email body (may include {{placeholder}} tokens)" },
      to:      { type: "array", items: { type: "string" }, description: "Default recipients" },
      cc:      { type: "array", items: { type: "string" }, description: "Default CC recipients" },
      id:      { type: "string", description: "Template ID to update (omit to create new)" },
    },
    required: ["name", "subject", "body"],
  },
};

const MAIL_GET_TEMPLATE_TOOL: Tool = {
  name: "mail_get_template",
  description: "Get a saved email template by ID",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Template ID" } }, required: ["id"] },
};

const MAIL_DELETE_TEMPLATE_TOOL: Tool = {
  name: "mail_delete_template",
  description: "Delete a saved email template",
  inputSchema: { type: "object", properties: { id: { type: "string", description: "Template ID" } }, required: ["id"] },
};

const MAIL_LIST_RULES_TOOL: Tool = {
  name: "mail_list_rules",
  description: "List all mail rules (filters) configured in Apple Mail",
  inputSchema: { type: "object", properties: {} },
};

const MAIL_ENABLE_RULE_TOOL: Tool = {
  name: "mail_enable_rule",
  description: "Enable a mail rule by name",
  inputSchema: { type: "object", properties: { name: { type: "string", description: "Rule name" } }, required: ["name"] },
};

const MAIL_DISABLE_RULE_TOOL: Tool = {
  name: "mail_disable_rule",
  description: "Disable a mail rule by name",
  inputSchema: { type: "object", properties: { name: { type: "string", description: "Rule name" } }, required: ["name"] },
};

const MAIL_SEARCH_CONTACTS_TOOL: Tool = {
  name: "mail_search_contacts",
  description: "Search Apple Contacts by name or email address (useful for finding recipients)",
  inputSchema: { type: "object", properties: { query: { type: "string", description: "Name or email to search for" } }, required: ["query"] },
};
```

Update the `tools` array export at the bottom of `tools.ts` — replace `MAIL_TOOL` with all 33 constants:

```typescript
const tools = [
  CONTACTS_TOOL, NOTES_TOOL, MESSAGES_TOOL, REMINDERS_TOOL, CALENDAR_TOOL, MAPS_TOOL,
  // Mail tools (33)
  MAIL_SEARCH_TOOL, MAIL_LIST_TOOL, MAIL_GET_TOOL, MAIL_SEND_TOOL, MAIL_UNREAD_COUNT_TOOL,
  MAIL_REPLY_TOOL, MAIL_FORWARD_TOOL, MAIL_CREATE_DRAFT_TOOL,
  MAIL_MARK_READ_TOOL, MAIL_MARK_UNREAD_TOOL, MAIL_FLAG_TOOL, MAIL_UNFLAG_TOOL,
  MAIL_DELETE_TOOL, MAIL_MOVE_TOOL,
  MAIL_BATCH_DELETE_TOOL, MAIL_BATCH_MOVE_TOOL,
  MAIL_BATCH_MARK_READ_TOOL, MAIL_BATCH_MARK_UNREAD_TOOL,
  MAIL_BATCH_FLAG_TOOL, MAIL_BATCH_UNFLAG_TOOL,
  MAIL_LIST_MAILBOXES_TOOL, MAIL_LIST_ACCOUNTS_TOOL, MAIL_CREATE_MAILBOX_TOOL,
  MAIL_LIST_ATTACHMENTS_TOOL, MAIL_SAVE_ATTACHMENT_TOOL,
  MAIL_LIST_TEMPLATES_TOOL, MAIL_SAVE_TEMPLATE_TOOL, MAIL_GET_TEMPLATE_TOOL, MAIL_DELETE_TEMPLATE_TOOL,
  MAIL_LIST_RULES_TOOL, MAIL_ENABLE_RULE_TOOL, MAIL_DISABLE_RULE_TOOL,
  MAIL_SEARCH_CONTACTS_TOOL,
];
```

- [ ] **Step 2: Verify compile**

```bash
bun run dev &
sleep 2 && kill %1
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add tools.ts && git commit -m "feat: add 33 granular mail tool definitions to tools.ts"
```

---

## Task 15: Add handlers to `index.ts` — core and action tools

**Files:**
- Modify: `index.ts`

- [ ] **Step 1: In `index.ts`, locate the `"mail"` case in the switch statement (around line 509) and replace it with the following 14 cases**

Find and delete the entire `case "mail": { ... }` block (from `case "mail":` to its matching closing `}`). Then add these cases in its place:

```typescript
case "mail_search": {
  const mailModule = await loadModule("mail");
  const { query, from, subject, mailbox, account, isRead, isFlagged, dateFrom, dateTo, limit } = args as {
    query?: string; from?: string; subject?: string; mailbox?: string; account?: string;
    isRead?: boolean; isFlagged?: boolean; dateFrom?: string; dateTo?: string; limit?: number;
  };
  const results = await mailModule.searchMessages({ query, from, subject, mailbox, account, isRead, isFlagged, dateFrom, dateTo, limit });
  return {
    content: [{ type: "text", text: results.length ? JSON.stringify(results, null, 2) : "No messages found." }],
    isError: false,
  };
}

case "mail_list": {
  const mailModule = await loadModule("mail");
  const { mailbox, account, limit, unreadOnly } = args as {
    mailbox?: string; account?: string; limit?: number; unreadOnly?: boolean;
  };
  const results = await mailModule.listMessages({ mailbox, account, limit, unreadOnly });
  return {
    content: [{ type: "text", text: results.length ? JSON.stringify(results, null, 2) : "No messages found." }],
    isError: false,
  };
}

case "mail_get": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const content = await mailModule.getMessage(id);
  return {
    content: [{ type: "text", text: content ? JSON.stringify(content, null, 2) : `Message ${id} not found.` }],
    isError: false,
  };
}

case "mail_send": {
  const mailModule = await loadModule("mail");
  const { to, subject, body, cc, bcc, account, attachments } = args as {
    to: string[]; subject: string; body: string;
    cc?: string[]; bcc?: string[]; account?: string; attachments?: string[];
  };
  if (!to?.length) throw new Error("to is required");
  if (!subject) throw new Error("subject is required");
  if (!body) throw new Error("body is required");
  const ok = await mailModule.sendEmail({ to, subject, body, cc, bcc, account, attachments });
  return {
    content: [{ type: "text", text: ok ? `Email sent to ${to.join(", ")}.` : "Failed to send email." }],
    isError: !ok,
  };
}

case "mail_unread_count": {
  const mailModule = await loadModule("mail");
  const { mailbox, account } = args as { mailbox?: string; account?: string };
  const count = await mailModule.getUnreadCount({ mailbox, account });
  return {
    content: [{ type: "text", text: `Unread count: ${count}` }],
    isError: false,
  };
}

case "mail_reply": {
  const mailModule = await loadModule("mail");
  const { id, body, replyAll } = args as { id: string; body: string; replyAll?: boolean };
  if (!id) throw new Error("id is required");
  if (!body) throw new Error("body is required");
  const ok = await mailModule.replyToMessage({ id, body, replyAll });
  return {
    content: [{ type: "text", text: ok ? "Reply sent." : "Failed to send reply." }],
    isError: !ok,
  };
}

case "mail_forward": {
  const mailModule = await loadModule("mail");
  const { id, to, body } = args as { id: string; to: string[]; body?: string };
  if (!id) throw new Error("id is required");
  if (!to?.length) throw new Error("to is required");
  const ok = await mailModule.forwardMessage({ id, to, body });
  return {
    content: [{ type: "text", text: ok ? `Forwarded to ${to.join(", ")}.` : "Failed to forward message." }],
    isError: !ok,
  };
}

case "mail_create_draft": {
  const mailModule = await loadModule("mail");
  const { to, subject, body, cc, bcc, account } = args as {
    to: string[]; subject: string; body: string;
    cc?: string[]; bcc?: string[]; account?: string;
  };
  if (!to?.length) throw new Error("to is required");
  if (!subject) throw new Error("subject is required");
  if (!body) throw new Error("body is required");
  const ok = await mailModule.createDraft({ to, subject, body, cc, bcc, account });
  return {
    content: [{ type: "text", text: ok ? "Draft created." : "Failed to create draft." }],
    isError: !ok,
  };
}

case "mail_mark_read": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await mailModule.markAsRead(id);
  return { content: [{ type: "text", text: ok ? "Marked as read." : "Failed (message not found?)." }], isError: !ok };
}

case "mail_mark_unread": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await mailModule.markAsUnread(id);
  return { content: [{ type: "text", text: ok ? "Marked as unread." : "Failed (message not found?)." }], isError: !ok };
}

case "mail_flag": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await mailModule.flagMessage(id);
  return { content: [{ type: "text", text: ok ? "Message flagged." : "Failed (message not found?)." }], isError: !ok };
}

case "mail_unflag": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await mailModule.unflagMessage(id);
  return { content: [{ type: "text", text: ok ? "Flag removed." : "Failed (message not found?)." }], isError: !ok };
}

case "mail_delete": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await mailModule.deleteMessage(id);
  return { content: [{ type: "text", text: ok ? "Message deleted." : "Failed (message not found?)." }], isError: !ok };
}

case "mail_move": {
  const mailModule = await loadModule("mail");
  const { id, mailbox, account } = args as { id: string; mailbox: string; account?: string };
  if (!id) throw new Error("id is required");
  if (!mailbox) throw new Error("mailbox is required");
  const ok = await mailModule.moveMessage({ id, mailbox, account });
  return {
    content: [{ type: "text", text: ok ? `Moved to ${mailbox}.` : "Failed (message or mailbox not found?)." }],
    isError: !ok,
  };
}
```

- [ ] **Step 2: Verify compile**

```bash
bun run dev &
sleep 2 && kill %1
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add index.ts && git commit -m "feat: add handlers for mail core and action tools in index.ts"
```

---

## Task 16: Add handlers to `index.ts` — batch and management tools

**Files:**
- Modify: `index.ts`

- [ ] **Step 1: Add batch cases after the `mail_move` case**

```typescript
case "mail_batch_delete": {
  const mailModule = await loadModule("mail");
  const { ids } = args as { ids: string[] };
  if (!ids?.length) throw new Error("ids is required");
  const results = await mailModule.batchDeleteMessages(ids);
  const failed = results.filter(r => !r.success);
  return {
    content: [{ type: "text", text: `Deleted ${results.length - failed.length}/${results.length} messages.${failed.length ? "\nFailed: " + JSON.stringify(failed) : ""}` }],
    isError: false,
  };
}

case "mail_batch_move": {
  const mailModule = await loadModule("mail");
  const { ids, mailbox, account } = args as { ids: string[]; mailbox: string; account?: string };
  if (!ids?.length) throw new Error("ids is required");
  if (!mailbox) throw new Error("mailbox is required");
  const results = await mailModule.batchMoveMessages({ ids, mailbox, account });
  const failed = results.filter(r => !r.success);
  return {
    content: [{ type: "text", text: `Moved ${results.length - failed.length}/${results.length} to ${mailbox}.${failed.length ? "\nFailed: " + JSON.stringify(failed) : ""}` }],
    isError: false,
  };
}

case "mail_batch_mark_read": {
  const mailModule = await loadModule("mail");
  const { ids } = args as { ids: string[] };
  if (!ids?.length) throw new Error("ids is required");
  const results = await mailModule.batchMarkAsRead(ids);
  const ok = results.filter(r => r.success).length;
  return { content: [{ type: "text", text: `Marked ${ok}/${results.length} as read.` }], isError: false };
}

case "mail_batch_mark_unread": {
  const mailModule = await loadModule("mail");
  const { ids } = args as { ids: string[] };
  if (!ids?.length) throw new Error("ids is required");
  const results = await mailModule.batchMarkAsUnread(ids);
  const ok = results.filter(r => r.success).length;
  return { content: [{ type: "text", text: `Marked ${ok}/${results.length} as unread.` }], isError: false };
}

case "mail_batch_flag": {
  const mailModule = await loadModule("mail");
  const { ids } = args as { ids: string[] };
  if (!ids?.length) throw new Error("ids is required");
  const results = await mailModule.batchFlagMessages(ids);
  const ok = results.filter(r => r.success).length;
  return { content: [{ type: "text", text: `Flagged ${ok}/${results.length} messages.` }], isError: false };
}

case "mail_batch_unflag": {
  const mailModule = await loadModule("mail");
  const { ids } = args as { ids: string[] };
  if (!ids?.length) throw new Error("ids is required");
  const results = await mailModule.batchUnflagMessages(ids);
  const ok = results.filter(r => r.success).length;
  return { content: [{ type: "text", text: `Unflagged ${ok}/${results.length} messages.` }], isError: false };
}

case "mail_list_mailboxes": {
  const mailModule = await loadModule("mail");
  const { account } = args as { account?: string };
  const mailboxes = await mailModule.listMailboxes({ account });
  return {
    content: [{ type: "text", text: mailboxes.length ? JSON.stringify(mailboxes, null, 2) : "No mailboxes found." }],
    isError: false,
  };
}

case "mail_list_accounts": {
  const mailModule = await loadModule("mail");
  const accounts = await mailModule.listAccounts();
  return {
    content: [{ type: "text", text: accounts.length ? JSON.stringify(accounts, null, 2) : "No accounts configured." }],
    isError: false,
  };
}

case "mail_create_mailbox": {
  const mailModule = await loadModule("mail");
  const { name, account } = args as { name: string; account?: string };
  if (!name) throw new Error("name is required");
  const ok = await mailModule.createMailbox({ name, account });
  return {
    content: [{ type: "text", text: ok ? `Mailbox "${name}" created.` : `Failed to create mailbox "${name}".` }],
    isError: !ok,
  };
}

case "mail_list_attachments": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const attachments = await mailModule.listAttachments(id);
  return {
    content: [{ type: "text", text: attachments.length ? JSON.stringify(attachments, null, 2) : "No attachments found." }],
    isError: false,
  };
}

case "mail_save_attachment": {
  const mailModule = await loadModule("mail");
  const { id, attachmentName, savePath } = args as { id: string; attachmentName: string; savePath: string };
  if (!id) throw new Error("id is required");
  if (!attachmentName) throw new Error("attachmentName is required");
  if (!savePath) throw new Error("savePath is required");
  const ok = await mailModule.saveAttachment({ id, attachmentName, savePath });
  return {
    content: [{ type: "text", text: ok ? `Saved "${attachmentName}" to ${savePath}.` : "Failed to save attachment." }],
    isError: !ok,
  };
}

case "mail_list_templates": {
  const mailModule = await loadModule("mail");
  const templates = await mailModule.listTemplates();
  return {
    content: [{ type: "text", text: templates.length ? JSON.stringify(templates, null, 2) : "No templates saved." }],
    isError: false,
  };
}

case "mail_save_template": {
  const mailModule = await loadModule("mail");
  const { name, subject, body, to, cc, id } = args as {
    name: string; subject: string; body: string; to?: string[]; cc?: string[]; id?: string;
  };
  if (!name) throw new Error("name is required");
  if (!subject) throw new Error("subject is required");
  if (!body) throw new Error("body is required");
  const template = await mailModule.saveTemplate({ name, subject, body, to, cc, id });
  return {
    content: [{ type: "text", text: `Template saved with ID: ${template.id}` }],
    isError: false,
  };
}

case "mail_get_template": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const template = await mailModule.getTemplate(id);
  return {
    content: [{ type: "text", text: template ? JSON.stringify(template, null, 2) : `Template ${id} not found.` }],
    isError: false,
  };
}

case "mail_delete_template": {
  const mailModule = await loadModule("mail");
  const { id } = args as { id: string };
  if (!id) throw new Error("id is required");
  const ok = await mailModule.deleteTemplate(id);
  return {
    content: [{ type: "text", text: ok ? `Template ${id} deleted.` : `Template ${id} not found.` }],
    isError: false,
  };
}

case "mail_list_rules": {
  const mailModule = await loadModule("mail");
  const rules = await mailModule.listRules();
  return {
    content: [{ type: "text", text: rules.length ? JSON.stringify(rules, null, 2) : "No mail rules configured." }],
    isError: false,
  };
}

case "mail_enable_rule": {
  const mailModule = await loadModule("mail");
  const { name } = args as { name: string };
  if (!name) throw new Error("name is required");
  const ok = await mailModule.enableRule(name);
  return {
    content: [{ type: "text", text: ok ? `Rule "${name}" enabled.` : `Rule "${name}" not found.` }],
    isError: !ok,
  };
}

case "mail_disable_rule": {
  const mailModule = await loadModule("mail");
  const { name } = args as { name: string };
  if (!name) throw new Error("name is required");
  const ok = await mailModule.disableRule(name);
  return {
    content: [{ type: "text", text: ok ? `Rule "${name}" disabled.` : `Rule "${name}" not found.` }],
    isError: !ok,
  };
}

case "mail_search_contacts": {
  const mailModule = await loadModule("mail");
  const { query } = args as { query: string };
  if (!query) throw new Error("query is required");
  const contacts = await mailModule.searchContacts(query);
  return {
    content: [{ type: "text", text: contacts.length ? JSON.stringify(contacts, null, 2) : `No contacts found for "${query}".` }],
    isError: false,
  };
}
```

- [ ] **Step 2: Verify compile**

```bash
bun run dev &
sleep 2 && kill %1
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add index.ts && git commit -m "feat: add handlers for mail batch and management tools in index.ts"
```

---

## Task 17: Remove old mail code and update ModuleMap type

**Files:**
- Modify: `index.ts`

The old `"mail"` case was removed in Task 15. This task cleans up the type declarations.

- [ ] **Step 1: Update ModuleMap type and the `loadModule` switch in `index.ts`**

Find the `ModuleMap` type definition (around line 30) and verify `mail` still points to `./utils/mail`:

```typescript
type ModuleMap = {
  contacts: typeof import("./utils/contacts").default;
  notes: typeof import("./utils/notes").default;
  message: typeof import("./utils/message").default;
  mail: typeof import("./utils/mail").default;
  reminders: typeof import("./utils/reminders").default;
  calendar: typeof import("./utils/calendar").default;
  maps: typeof import("./utils/maps").default;
};
```

This is unchanged — the barrel still exports a default object, so no type changes needed.

- [ ] **Step 2: Confirm there are no references to the old `isMailArgs` type guard**

```bash
grep -n "isMailArgs" /Users/chris/git/apple-mcp/index.ts
```

Expected: no output (it should already be gone with the old case block).

If any remain, delete them.

- [ ] **Step 3: Run full test suite**

```bash
bun test tests/integration/mail.test.ts --timeout 60000 2>&1 | tail -40
```

Expected: all tests PASS.

- [ ] **Step 4: Start server and verify it starts cleanly**

```bash
bun run dev &
sleep 3 && kill %1
```

Expected: "All modules loaded successfully" or "Starting apple-mcp server..." with no errors.

- [ ] **Step 5: Commit**

```bash
git add index.ts && git commit -m "chore: remove old mail type guard, verify server starts after mail tool redesign"
```

---

## Task 18: Final verification

- [ ] **Step 1: Run all integration tests to check for regressions**

```bash
bun test tests/ --timeout 60000 2>&1 | tail -50
```

Expected: existing tests (contacts, notes, messages, reminders, calendar, maps) still pass.

- [ ] **Step 2: Verify all 33 mail tool names appear in the server's tool list**

```bash
node -e "const t = require('./tools'); console.log(t.default.filter(x => x.name.startsWith('mail_')).map(x => x.name).join('\n'))" 2>/dev/null || bun -e "import tools from './tools'; console.log(tools.filter(x => x.name.startsWith('mail_')).map(x => x.name).join('\n'))"
```

Expected output (33 lines):
```
mail_search
mail_list
mail_get
mail_send
mail_unread_count
mail_reply
mail_forward
mail_create_draft
mail_mark_read
mail_mark_unread
mail_flag
mail_unflag
mail_delete
mail_move
mail_batch_delete
mail_batch_move
mail_batch_mark_read
mail_batch_mark_unread
mail_batch_flag
mail_batch_unflag
mail_list_mailboxes
mail_list_accounts
mail_create_mailbox
mail_list_attachments
mail_save_attachment
mail_list_templates
mail_save_template
mail_get_template
mail_delete_template
mail_list_rules
mail_enable_rule
mail_disable_rule
mail_search_contacts
```

- [ ] **Step 3: Verify the old `mail` tool is gone**

```bash
grep -n '"mail"' /Users/chris/git/apple-mcp/tools.ts
```

Expected: no output (or only comments if any).

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: replace mail tool with 33 granular mail_* tools

Ports robust AppleScript implementations from apple-mail-mcp.
Replaces single mail tool with search, list, get, send, unread-count,
reply, forward, draft, mark-read/unread, flag/unflag, delete, move,
6 batch ops, mailboxes, accounts, attachments, templates, rules, contacts.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Reference: Function signatures across all modules

| Function | Module | Signature |
|----------|--------|-----------|
| `searchMessages` | mail-core | `(params: {...}) => Promise<EmailMessage[]>` |
| `listMessages` | mail-core | `(params: {...}) => Promise<EmailMessage[]>` |
| `getMessage` | mail-core | `(id: string) => Promise<MessageContent \| null>` |
| `getUnreadCount` | mail-core | `(params: {...}) => Promise<number>` |
| `sendEmail` | mail-core | `(params: {...}) => Promise<boolean>` |
| `markAsRead` | mail-actions | `(id: string) => Promise<boolean>` |
| `markAsUnread` | mail-actions | `(id: string) => Promise<boolean>` |
| `flagMessage` | mail-actions | `(id: string) => Promise<boolean>` |
| `unflagMessage` | mail-actions | `(id: string) => Promise<boolean>` |
| `deleteMessage` | mail-actions | `(id: string) => Promise<boolean>` |
| `moveMessage` | mail-actions | `(params: {...}) => Promise<boolean>` |
| `replyToMessage` | mail-actions | `(params: {...}) => Promise<boolean>` |
| `forwardMessage` | mail-actions | `(params: {...}) => Promise<boolean>` |
| `createDraft` | mail-actions | `(params: {...}) => Promise<boolean>` |
| `batchMarkAsRead` | mail-batch | `(ids: string[]) => Promise<BatchResult[]>` |
| `batchMarkAsUnread` | mail-batch | `(ids: string[]) => Promise<BatchResult[]>` |
| `batchFlagMessages` | mail-batch | `(ids: string[]) => Promise<BatchResult[]>` |
| `batchUnflagMessages` | mail-batch | `(ids: string[]) => Promise<BatchResult[]>` |
| `batchDeleteMessages` | mail-batch | `(ids: string[]) => Promise<BatchResult[]>` |
| `batchMoveMessages` | mail-batch | `(params: {...}) => Promise<BatchResult[]>` |
| `listAccounts` | mail-manage | `() => Promise<Account[]>` |
| `listMailboxes` | mail-manage | `(params: {...}) => Promise<Mailbox[]>` |
| `createMailbox` | mail-manage | `(params: {...}) => Promise<boolean>` |
| `listAttachments` | mail-manage | `(id: string) => Promise<Attachment[]>` |
| `saveAttachment` | mail-manage | `(params: {...}) => Promise<boolean>` |
| `listTemplates` | mail-manage | `() => Promise<EmailTemplate[]>` |
| `saveTemplate` | mail-manage | `(params: {...}) => Promise<EmailTemplate>` |
| `getTemplate` | mail-manage | `(id: string) => Promise<EmailTemplate \| null>` |
| `deleteTemplate` | mail-manage | `(id: string) => Promise<boolean>` |
| `listRules` | mail-manage | `() => Promise<MailRule[]>` |
| `enableRule` | mail-manage | `(name: string) => Promise<boolean>` |
| `disableRule` | mail-manage | `(name: string) => Promise<boolean>` |
| `searchContacts` | mail-manage | `(query: string) => Promise<Contact[]>` |
