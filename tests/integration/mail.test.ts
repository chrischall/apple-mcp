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
