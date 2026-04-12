import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Import after mocking
const mailModule = (await import("../../utils/mail.js")).default;

// ─── requestMailAccess ─────────────────────────────────────────────────────

describe("mail.requestMailAccess", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return hasAccess true when Mail app responds", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		const result = await mailModule.requestMailAccess();

		expect(result.hasAccess).toBe(true);
		expect(result.message).toContain("already granted");
	});

	it("should return hasAccess false when Mail app throws", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await mailModule.requestMailAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Mail access is required");
	});

	it("should include setup instructions when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await mailModule.requestMailAccess();

		expect(result.message).toContain("System Settings");
		expect(result.message).toContain("Privacy & Security");
		expect(result.message).toContain("Automation");
	});
});

// ─── getUnreadMails ────────────────────────────────────────────────────────

describe("mail.getUnreadMails", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return empty array on SUCCESS: response", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail") // access check
			.mockResolvedValueOnce("SUCCESS:5"); // getUnreadMails script

		const result = await mailModule.getUnreadMails();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
	});

	it("should return empty array on non-SUCCESS response", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("something unexpected");

		const result = await mailModule.getUnreadMails();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should respect limit parameter in AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS:3");

		await mailModule.getUnreadMails(3);

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("3");
	});

	it("should cap limit at MAX_EMAILS (20)", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS:20");

		await mailModule.getUnreadMails(100);

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		// The script should contain 20, not 100
		expect(script).toContain("20");
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await mailModule.getUnreadMails();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await mailModule.getUnreadMails();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should use default limit of 10", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS:0");

		await mailModule.getUnreadMails();

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("10");
	});
});

// ─── searchMails ───────────────────────────────────────────────────────────

describe("mail.searchMails", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return empty array for empty search term", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail"); // access check

		const result = await mailModule.searchMails("");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array for whitespace-only search term", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		const result = await mailModule.searchMails("   ");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array on SUCCESS: response", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS:3");

		const result = await mailModule.searchMails("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
	});

	it("should return empty array on non-SUCCESS response", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("unexpected");

		const result = await mailModule.searchMails("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should respect limit capped at 20", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS:0");

		await mailModule.searchMails("test", 50);

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("20");
	});

	it("should pass search term into the AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS:0");

		await mailModule.searchMails("invoice");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("invoice");
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await mailModule.searchMails("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await mailModule.searchMails("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── sendMail ──────────────────────────────────────────────────────────────

describe("mail.sendMail", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should send email successfully and return confirmation", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail") // access check
			.mockResolvedValueOnce("SUCCESS"); // send script

		const result = await mailModule.sendMail("user@example.com", "Hello", "Body text");

		expect(result).toContain("Email sent to user@example.com");
		expect(result).toContain("Hello");
	});

	it("should throw on empty to address", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		expect(mailModule.sendMail("", "Subject", "Body")).rejects.toThrow("To address is required");
	});

	it("should throw on whitespace-only to address", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		expect(mailModule.sendMail("   ", "Subject", "Body")).rejects.toThrow("To address is required");
	});

	it("should throw on empty subject", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		expect(mailModule.sendMail("user@example.com", "", "Body")).rejects.toThrow("Subject is required");
	});

	it("should throw on empty body", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		expect(mailModule.sendMail("user@example.com", "Subject", "")).rejects.toThrow("Email body is required");
	});

	it("should throw when AppleScript returns non-SUCCESS", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("FAILURE");

		expect(mailModule.sendMail("user@example.com", "Subject", "Body")).rejects.toThrow("Failed to send email");
	});

	it("should throw when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		expect(mailModule.sendMail("user@example.com", "Subject", "Body")).rejects.toThrow();
	});

	it("should throw when AppleScript errors during send", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockRejectedValueOnce(new Error("send failed"));

		expect(mailModule.sendMail("user@example.com", "Subject", "Body")).rejects.toThrow("send failed");
	});

	it("should include cc in the AppleScript when provided", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS");

		await mailModule.sendMail("to@example.com", "Subject", "Body", "cc@example.com");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("cc@example.com");
		expect(script).toContain("cc recipient");
	});

	it("should include bcc in the AppleScript when provided", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS");

		await mailModule.sendMail("to@example.com", "Subject", "Body", undefined, "bcc@example.com");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("bcc@example.com");
		expect(script).toContain("bcc recipient");
	});

	it("should include subject in the AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS");

		await mailModule.sendMail("user@example.com", "Important Meeting", "Body text");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("Important Meeting");
	});

	it("should escape double quotes in subject", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("SUCCESS");

		await mailModule.sendMail("user@example.com", 'Re: "Hello"', "Body text");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain('\\"Hello\\"');
	});
});

// ─── getMailboxes ──────────────────────────────────────────────────────────

describe("mail.getMailboxes", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return string array from AppleScript result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail") // access check
			.mockResolvedValueOnce(["Inbox", "Sent", "Drafts"]); // getMailboxes script

		const result = await mailModule.getMailboxes();

		expect(result).toEqual(["Inbox", "Sent", "Drafts"]);
	});

	it("should filter out non-string values from result array", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce(["Inbox", null, undefined, "", "Sent"]);

		const result = await mailModule.getMailboxes();

		expect(result).toEqual(["Inbox", "Sent"]);
	});

	it("should return empty array for non-array result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("not an array");

		const result = await mailModule.getMailboxes();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await mailModule.getMailboxes();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await mailModule.getMailboxes();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── getAccounts ───────────────────────────────────────────────────────────

describe("mail.getAccounts", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return string array from AppleScript result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail") // access check
			.mockResolvedValueOnce(["Default Account"]); // getAccounts script

		const result = await mailModule.getAccounts();

		expect(result).toEqual(["Default Account"]);
	});

	it("should filter out non-string values", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce(["iCloud", null, "Gmail"]);

		const result = await mailModule.getAccounts();

		expect(result).toEqual(["iCloud", "Gmail"]);
	});

	it("should return empty array for non-array result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("not an array");

		const result = await mailModule.getAccounts();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await mailModule.getAccounts();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await mailModule.getAccounts();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── getMailboxesForAccount ────────────────────────────────────────────────

describe("mail.getMailboxesForAccount", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return empty array for empty account name", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		const result = await mailModule.getMailboxesForAccount("");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array for whitespace-only account name", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Mail");

		const result = await mailModule.getMailboxesForAccount("   ");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return string array from AppleScript result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce(["Inbox", "Sent", "Trash"]);

		const result = await mailModule.getMailboxesForAccount("iCloud");

		expect(result).toEqual(["Inbox", "Sent", "Trash"]);
	});

	it("should pass account name into the AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce([]);

		await mailModule.getMailboxesForAccount("Work Account");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("Work Account");
	});

	it("should return empty array for non-array result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("not an array");

		const result = await mailModule.getMailboxesForAccount("iCloud");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await mailModule.getMailboxesForAccount("iCloud");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await mailModule.getMailboxesForAccount("iCloud");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── getLatestMails ────────────────────────────────────────────────────────

describe("mail.getLatestMails", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return parsed email data from AppleScript result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail") // access check
			.mockResolvedValueOnce("{subject:Test Email, sender:alice@example.com, date:2026-04-12, mailbox:Inbox, content:Hello}");

		const result = await mailModule.getLatestMails("iCloud");

		expect(result).toHaveLength(1);
		expect(result[0].subject).toBe("Test Email");
		expect(result[0].sender).toBe("alice@example.com");
		expect(result[0].mailbox).toContain("iCloud");
	});

	it("should return empty array on Error: prefix result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("Error: account not found");

		const result = await mailModule.getLatestMails("nonexistent");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when no matches found in result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("no curly braces here");

		const result = await mailModule.getLatestMails("iCloud");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await mailModule.getLatestMails("iCloud");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await mailModule.getLatestMails("iCloud");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should pass account name and limit into the AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("");

		await mailModule.getLatestMails("Work", 10);

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("Work");
		expect(script).toContain("10");
	});

	it("should handle multiple email records in result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce(
				"{subject:Email 1, sender:a@test.com, date:2026-04-12, mailbox:Inbox}" +
				"{subject:Email 2, sender:b@test.com, date:2026-04-11, mailbox:Sent}"
			);

		const result = await mailModule.getLatestMails("iCloud");

		expect(result).toHaveLength(2);
		expect(result[0].subject).toBe("Email 1");
		expect(result[1].subject).toBe("Email 2");
	});

	it("should fill defaults for missing fields", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Mail")
			.mockResolvedValueOnce("{subject:Only Subject}");

		const result = await mailModule.getLatestMails("iCloud");

		expect(result).toHaveLength(1);
		expect(result[0].subject).toBe("Only Subject");
		expect(result[0].sender).toBe("Unknown sender");
		expect(result[0].content).toBe("[Content not available]");
		expect(result[0].isRead).toBe(false);
	});
});
