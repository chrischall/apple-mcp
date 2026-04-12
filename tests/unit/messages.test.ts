import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

const mockExec = mock((cmd: string, callback: Function) => {
	callback(null, { stdout: "", stderr: "" });
});
mock.module("node:child_process", () => ({
	exec: mockExec,
}));

const mockAccess = mock(() => Promise.resolve(undefined));
mock.module("node:fs/promises", () => ({
	access: mockAccess,
}));

// Import after mocking
const messageModule = (await import("../../utils/message.js")).default;

// ─── helpers ───────────────────────────────────────────────────────────────

/** Configure mocks so checkMessagesDBAccess returns true */
function mockDBAccessGranted() {
	mockAccess.mockResolvedValueOnce(undefined);
	mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
		cb(null, { stdout: "1", stderr: "" });
	});
}

/** Configure mocks so checkMessagesDBAccess returns false */
function mockDBAccessDenied() {
	mockAccess.mockRejectedValueOnce(new Error("ENOENT"));
}

// ─── sendMessage ───────────────────────────────────────────────────────────

describe("messages.sendMessage", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
		mockExec.mockReset();
		mockAccess.mockReset();
	});

	it("should call runAppleScript with the phone number and message", async () => {
		mockRunAppleScript.mockResolvedValueOnce("sent");

		const result = await messageModule.sendMessage("+15551234567", "Hello");

		expect(mockRunAppleScript).toHaveBeenCalledTimes(1);
		const script = mockRunAppleScript.mock.calls[0][0] as string;
		expect(script).toContain("+15551234567");
		expect(script).toContain("Hello");
		expect(result).toBe("sent");
	});

	it("should escape double quotes in the message", async () => {
		mockRunAppleScript.mockResolvedValueOnce("sent");

		await messageModule.sendMessage("+15551234567", 'Say "hi"');

		const script = mockRunAppleScript.mock.calls[0][0] as string;
		expect(script).toContain('Say \\"hi\\"');
	});

	it("should return the AppleScript result", async () => {
		mockRunAppleScript.mockResolvedValueOnce("message sent ok");

		const result = await messageModule.sendMessage("+15550000000", "Test");

		expect(result).toBe("message sent ok");
	});
});

// ─── scheduleMessage ───────────────────────────────────────────────────────

describe("messages.scheduleMessage", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
		mockExec.mockReset();
		mockAccess.mockReset();
	});

	it("should throw for a time in the past", async () => {
		const pastDate = new Date(Date.now() - 60_000);

		expect(
			messageModule.scheduleMessage("+15551234567", "Late", pastDate),
		).rejects.toThrow("Cannot schedule message in the past");
	});

	it("should return scheduled details for a future time", async () => {
		mockRunAppleScript.mockResolvedValueOnce("sent"); // in case setTimeout fires instantly

		const futureDate = new Date(Date.now() + 60_000);
		const result = await messageModule.scheduleMessage(
			"+15559999999",
			"Future msg",
			futureDate,
		);

		expect(result.phoneNumber).toBe("+15559999999");
		expect(result.message).toBe("Future msg");
		expect(result.scheduledTime).toBe(futureDate);
		expect(result.id).toBeDefined();

		// Clean up the timer so it doesn't fire after the test
		clearTimeout(result.id);
	});
});

// ─── requestMessagesAccess ─────────────────────────────────────────────────

describe("messages.requestMessagesAccess", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
		mockExec.mockReset();
		mockAccess.mockReset();
	});

	it("should return hasAccess true when DB is accessible", async () => {
		mockDBAccessGranted();

		const result = await messageModule.requestMessagesAccess();

		expect(result.hasAccess).toBe(true);
		expect(result.message).toContain("already granted");
	});

	it("should return hasAccess false when DB access fails but Messages app responds", async () => {
		mockDBAccessDenied();
		mockRunAppleScript.mockResolvedValueOnce("Messages");

		const result = await messageModule.requestMessagesAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Full Disk Access");
	});

	it("should return hasAccess false when both DB access and Messages app fail", async () => {
		mockDBAccessDenied();
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await messageModule.requestMessagesAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Automation");
	});
});

// ─── readMessages ──────────────────────────────────────────────────────────

describe("messages.readMessages", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
		mockExec.mockReset();
		mockAccess.mockReset();
	});

	it("should return empty array when access is denied", async () => {
		mockDBAccessDenied();
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await messageModule.readMessages("+15551234567");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when query returns empty stdout", async () => {
		// access check: fs access + exec for "SELECT 1"
		mockDBAccessGranted();
		// the actual query returns empty
		mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
			cb(null, { stdout: "", stderr: "" });
		});

		const result = await messageModule.readMessages("+15551234567");

		expect(result).toEqual([]);
	});

	it("should return empty array on exec error", async () => {
		// access check passes
		mockDBAccessGranted();
		// the actual query throws — must fail on all retry attempts (MAX_RETRIES=3 + 1 initial)
		for (let i = 0; i < 4; i++) {
			mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
				cb(new Error("database is locked"), null);
			});
		}

		const result = await messageModule.readMessages("+15551234567");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	}, 15_000);

	it("should enforce max limit of 50", async () => {
		mockDBAccessGranted();
		// Capture the SQL query from exec
		let capturedCmd = "";
		mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
			capturedCmd = cmd;
			cb(null, { stdout: "", stderr: "" });
		});

		await messageModule.readMessages("+15551234567", 100);

		expect(capturedCmd).toContain("LIMIT 50");
	});

	it("should parse messages from JSON stdout", async () => {
		mockDBAccessGranted();

		const mockMessages = JSON.stringify([
			{
				message_id: 1,
				content: "Hey there",
				date: "2026-04-10 14:30:00",
				sender: "+15559876543",
				is_from_me: 0,
				is_audio_message: 0,
				cache_has_attachments: 0,
				subject: null,
				content_type: 0,
			},
		]);

		mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
			cb(null, { stdout: mockMessages, stderr: "" });
		});

		const result = await messageModule.readMessages("+15559876543", 5);

		expect(result).toHaveLength(1);
		expect(result[0].content).toBe("Hey there");
		expect(result[0].is_from_me).toBe(false);
		expect(result[0].sender).toBe("+15559876543");
	});
});

// ─── getUnreadMessages ─────────────────────────────────────────────────────

describe("messages.getUnreadMessages", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
		mockExec.mockReset();
		mockAccess.mockReset();
	});

	it("should return empty array when access is denied", async () => {
		mockDBAccessDenied();
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await messageModule.getUnreadMessages();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when no unread messages", async () => {
		mockDBAccessGranted();
		mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
			cb(null, { stdout: "", stderr: "" });
		});

		const result = await messageModule.getUnreadMessages();

		expect(result).toEqual([]);
	});

	it("should enforce max limit of 50", async () => {
		mockDBAccessGranted();
		mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
			expect(cmd).toContain("LIMIT 50");
			cb(null, { stdout: "", stderr: "" });
		});

		await messageModule.getUnreadMessages(200);
	});

	it("should return empty array on error", async () => {
		mockDBAccessGranted();
		// Must fail on all retry attempts (MAX_RETRIES=3 + 1 initial)
		for (let i = 0; i < 4; i++) {
			mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
				cb(new Error("database is locked"), null);
			});
		}

		const result = await messageModule.getUnreadMessages();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	}, 15_000);

	it("should parse unread messages from JSON stdout", async () => {
		mockDBAccessGranted();

		const mockMessages = JSON.stringify([
			{
				message_id: 42,
				content: "Are you there?",
				date: "2026-04-12 09:15:00",
				sender: "+15550001111",
				is_from_me: 0,
				is_audio_message: 0,
				cache_has_attachments: 0,
				subject: null,
				content_type: 0,
			},
		]);

		mockExec.mockImplementationOnce((cmd: string, cb: Function) => {
			cb(null, { stdout: mockMessages, stderr: "" });
		});

		const result = await messageModule.getUnreadMessages(10);

		expect(result).toHaveLength(1);
		expect(result[0].content).toBe("Are you there?");
		expect(result[0].is_from_me).toBe(false);
		expect(result[0].sender).toBe("+15550001111");
	});
});
