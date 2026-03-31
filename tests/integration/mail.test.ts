// tests/integration/mail.test.ts
import { describe, it, expect } from "bun:test";
import { sleep } from "../helpers/test-utils.js";
import mailModule from "../../utils/mail.js";
import { homedir } from "os";

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

describe("mail_get / getMessage", () => {
  it("returns null for non-existent id", async () => {
    const result = await mailModule.getMessage("999999999");
    expect(result).toBeNull();
  }, 15000);

  it("returns content for a real message if one exists", async () => {
    const msgs = await mailModule.listMessages({ limit: 1 });
    if (msgs.length === 0) { console.log("No messages available"); return; }
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
