import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Import after mocking
const remindersModule = (await import("../../utils/reminders.js")).default;

// ─── requestRemindersAccess ────────────────────────────────────────────────

describe("reminders.requestRemindersAccess", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return hasAccess true when Reminders app responds", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Reminders");

		const result = await remindersModule.requestRemindersAccess();

		expect(result.hasAccess).toBe(true);
		expect(result.message).toContain("already granted");
	});

	it("should return hasAccess false when Reminders app throws", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await remindersModule.requestRemindersAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Reminders access is required");
	});

	it("should include setup instructions when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await remindersModule.requestRemindersAccess();

		expect(result.message).toContain("System Settings");
		expect(result.message).toContain("Privacy & Security");
		expect(result.message).toContain("Automation");
	});
});

// ─── getAllLists ────────────────────────────────────────────────────────────

describe("reminders.getAllLists", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return lists array on success", async () => {
		const mockLists = [
			{ name: "Shopping", id: "list-1" },
			{ name: "Work", id: "list-2" },
		];

		mockRunAppleScript
			.mockResolvedValueOnce("Reminders") // access check
			.mockResolvedValueOnce(mockLists); // getAllLists script

		const result = await remindersModule.getAllLists();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Shopping");
		expect(result[0].id).toBe("list-1");
		expect(result[1].name).toBe("Work");
		expect(result[1].id).toBe("list-2");
	});

	it("should handle non-array result gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce("unexpected string");

		const result = await remindersModule.getAllLists();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(1);
	});

	it("should handle null result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce(null);

		const result = await remindersModule.getAllLists();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should fill in defaults for missing list fields", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce([{}]); // list with no fields

		const result = await remindersModule.getAllLists();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Untitled List");
		expect(result[0].id).toBe("unknown-id");
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await remindersModule.getAllLists();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await remindersModule.getAllLists();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── getAllReminders ───────────────────────────────────────────────────────

describe("reminders.getAllReminders", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return empty array on SUCCESS result (performance stub)", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders") // access check
			.mockResolvedValueOnce("SUCCESS:found_lists_but_reminders_query_too_slow");

		const result = await remindersModule.getAllReminders();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array on non-SUCCESS result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce({});

		const result = await remindersModule.getAllReminders();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should accept optional listName parameter", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce("SUCCESS:found");

		const result = await remindersModule.getAllReminders("Shopping");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await remindersModule.getAllReminders();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await remindersModule.getAllReminders();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── searchReminders ──────────────────────────────────────────────────────

describe("reminders.searchReminders", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return empty array for empty search text", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Reminders"); // access check

		const result = await remindersModule.searchReminders("");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array for whitespace-only search text", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Reminders");

		const result = await remindersModule.searchReminders("   ");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array (performance stub) for valid search", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders") // access check
			.mockResolvedValueOnce("SUCCESS:reminder_search_not_implemented_for_performance");

		const result = await remindersModule.searchReminders("groceries");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await remindersModule.searchReminders("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await remindersModule.searchReminders("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── createReminder ───────────────────────────────────────────────────────

describe("reminders.createReminder", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should create a reminder successfully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders") // access check
			.mockResolvedValueOnce("SUCCESS:Shopping"); // create script

		const result = await remindersModule.createReminder("Buy milk");

		expect(result.name).toBe("Buy milk");
		expect(result.id).toBe("created-reminder-id");
		expect(result.listName).toBe("Shopping");
		expect(result.completed).toBe(false);
	});

	it("should return reminder with notes and dueDate when provided", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce("SUCCESS:Work");

		const result = await remindersModule.createReminder(
			"Finish report",
			"Work",
			"Q3 summary",
			"2026-04-20T17:00:00.000Z",
		);

		expect(result.name).toBe("Finish report");
		expect(result.body).toBe("Q3 summary");
		expect(result.dueDate).toBe("2026-04-20T17:00:00.000Z");
		expect(result.listName).toBe("Work");
	});

	it("should return reminder with empty body when notes not provided", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce("SUCCESS:Reminders");

		const result = await remindersModule.createReminder("Simple task");

		expect(result.body).toBe("");
		expect(result.dueDate).toBeNull();
	});

	it("should throw on empty name", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Reminders"); // access check passes

		expect(remindersModule.createReminder("")).rejects.toThrow();
	});

	it("should throw on whitespace-only name", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Reminders");

		expect(remindersModule.createReminder("   ")).rejects.toThrow();
	});

	it("should throw on ERROR result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce("ERROR:No lists available");

		expect(remindersModule.createReminder("Test")).rejects.toThrow(
			"Failed to create reminder",
		);
	});

	it("should throw on access denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		expect(remindersModule.createReminder("Test")).rejects.toThrow();
	});

	it("should throw when AppleScript errors during creation", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockRejectedValueOnce(new Error("script error"));

		expect(remindersModule.createReminder("Test")).rejects.toThrow(
			"script error",
		);
	});

	it("should escape double quotes in name", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce("SUCCESS:Reminders");

		await remindersModule.createReminder('Buy "organic" milk');

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain('Buy \\"organic\\" milk');
	});
});

// ─── openReminder ─────────────────────────────────────────────────────────

describe("reminders.openReminder", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return success false when no matching reminders found", async () => {
		// searchReminders internally calls requestRemindersAccess then the search script
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders") // access check for openReminder
			.mockResolvedValueOnce("Reminders") // access check for searchReminders
			.mockResolvedValueOnce("SUCCESS:stub"); // searchReminders script (returns [])

		const result = await remindersModule.openReminder("nonexistent");

		expect(result.success).toBe(false);
		expect(result.message).toContain("No matching reminders found");
	});

	it("should return success false when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await remindersModule.openReminder("test");

		expect(result.success).toBe(false);
	});

	it("should handle errors gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders") // access check for openReminder
			.mockRejectedValueOnce(new Error("unexpected error")); // searchReminders access check fails

		const result = await remindersModule.openReminder("test");

		// searchReminders catches its own error and returns [], so openReminder sees no matches
		expect(result.success).toBe(false);
	});
});

// ─── getRemindersFromListById ─────────────────────────────────────────────

describe("reminders.getRemindersFromListById", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return empty array (performance stub)", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders") // access check
			.mockResolvedValueOnce("SUCCESS:reminders_by_id_not_implemented_for_performance");

		const result = await remindersModule.getRemindersFromListById("list-123");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should accept optional props parameter", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockResolvedValueOnce("SUCCESS:stub");

		const result = await remindersModule.getRemindersFromListById(
			"list-123",
			["name", "dueDate"],
		);

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await remindersModule.getRemindersFromListById("list-123");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Reminders")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await remindersModule.getRemindersFromListById("list-123");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});
