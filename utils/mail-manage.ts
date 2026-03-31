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

function parseMailboxList(raw: string, account: string): Mailbox[] {
  if (!raw.trim()) return [];
  return raw.split("|||ITEM|||").flatMap(item => {
    const parts = item.split("|||");
    if (parts.length < 3) return [];
    return [{ name: parts[0], account, unreadCount: parseInt(parts[1]) || 0, messageCount: parseInt(parts[2]) || 0 }];
  });
}

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
    if (account) {
      const raw = await runAppleScript(accountScript(account, cmd));
      return parseMailboxList(raw, account);
    }
    const accounts = await listAccounts();
    if (accounts.length === 0) return [];
    const raw = await runAppleScript(accountScript(accounts[0].name, cmd));
    return parseMailboxList(raw, accounts[0].name);
  } catch (error) {
    console.error("listMailboxes error:", error);
    return [];
  }
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

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function listAttachments(id: string): Promise<Attachment[]> {
  try {
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

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

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
  const template: EmailTemplate = {
    id,
    name: params.name,
    subject: params.subject,
    body: params.body,
    to: params.to,
    cc: params.cc,
  };
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

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default {
  listAccounts, listMailboxes, createMailbox,
  listAttachments, saveAttachment,
  listTemplates, saveTemplate, getTemplate, deleteTemplate,
  listRules, enableRule, disableRule,
  searchContacts,
};
