import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Import after mocking
const calendarModule = (await import("../../utils/calendar.js")).default;

describe("calendar.updateEvent", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
		// Default: access check passes, find-source returns a calendar name,
		// then in-place update succeeds.
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar") // access check
			.mockResolvedValueOnce("Personal") // find source calendar
			.mockResolvedValueOnce("updated"); // in-place update
	});

	it("should update event title", async () => {
		const result = await calendarModule.updateEvent("test-uid-123", {
			title: "New Title",
		});

		expect(result.success).toBe(true);
		expect(result.message).toContain("updated");
		const updateCall = mockRunAppleScript.mock.calls[2][0] as string;
		expect(updateCall).toContain("test-uid-123");
		expect(updateCall).toContain("New Title");
	});

	it("should update multiple fields at once", async () => {
		const result = await calendarModule.updateEvent("test-uid-123", {
			title: "Updated Meeting",
			location: "Room 42",
			notes: "Bring laptop",
		});

		expect(result.success).toBe(true);
		const updateCall = mockRunAppleScript.mock.calls[2][0] as string;
		expect(updateCall).toContain("Updated Meeting");
		expect(updateCall).toContain("Room 42");
		expect(updateCall).toContain("Bring laptop");
	});

	it("should update start and end dates atomically", async () => {
		const start = "2026-04-15T10:00:00.000Z";
		const end = "2026-04-15T11:00:00.000Z";

		const result = await calendarModule.updateEvent("test-uid-123", {
			startDate: start,
			endDate: end,
		});

		expect(result.success).toBe(true);
		const updateCall = mockRunAppleScript.mock.calls[2][0] as string;
		// Should use `set properties of ... to {...}` so start/end change
		// atomically — otherwise Calendar rejects mid-update when the new
		// start briefly lands after the old end.
		expect(updateCall).toContain("set properties of targetEvent");
		expect(updateCall).toContain("start date");
		expect(updateCall).toContain("end date");
	});

	it("should update isAllDay flag", async () => {
		const result = await calendarModule.updateEvent("test-uid-123", {
			isAllDay: true,
		});

		expect(result.success).toBe(true);
		const updateCall = mockRunAppleScript.mock.calls[2][0] as string;
		expect(updateCall).toContain("allday event");
	});

	it("should reject when no fields are provided", async () => {
		mockRunAppleScript.mockReset(); // no AppleScript calls expected
		const result = await calendarModule.updateEvent("test-uid-123", {});

		expect(result.success).toBe(false);
		expect(result.message).toContain("at least one field");
	});

	it("should reject when eventId is empty", async () => {
		mockRunAppleScript.mockReset();
		const result = await calendarModule.updateEvent("", {
			title: "New Title",
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("Event ID");
	});

	it("should reject invalid date formats", async () => {
		mockRunAppleScript.mockReset();
		const result = await calendarModule.updateEvent("test-uid-123", {
			startDate: "not-a-date",
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("Invalid");
	});

	it("should reject when end date is before start date", async () => {
		mockRunAppleScript.mockReset();
		const result = await calendarModule.updateEvent("test-uid-123", {
			startDate: "2026-04-15T12:00:00.000Z",
			endDate: "2026-04-15T10:00:00.000Z",
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("after start date");
	});

	it("should handle calendar access denied", async () => {
		mockRunAppleScript.mockReset();
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await calendarModule.updateEvent("test-uid-123", {
			title: "New Title",
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("access");
	});

	it("should handle AppleScript errors during update", async () => {
		mockRunAppleScript.mockReset();
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar") // access check passes
			.mockRejectedValueOnce(new Error("event not found")); // find-source fails

		const result = await calendarModule.updateEvent("test-uid-123", {
			title: "New Title",
		});

		expect(result.success).toBe(false);
		// The find-source step throws "event not found"; we translate it into
		// a user-facing "Event not found with ID X" message.
		expect(result.message).toMatch(/not found/i);
	});
});
