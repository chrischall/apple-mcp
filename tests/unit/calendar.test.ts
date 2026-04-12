import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Import after mocking
const calendarModule = (await import("../../utils/calendar.js")).default;

// ─── getEvents ──────────────────────────────────────────────────────────────

describe("calendar.getEvents", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return events array on success", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar") // access check
			.mockResolvedValueOnce([]); // getEvents script

		const result = await calendarModule.getEvents();

		expect(Array.isArray(result)).toBe(true);
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
	});

	it("should pass date range into the AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce([]);

		await calendarModule.getEvents(5, "2026-05-01", "2026-05-31");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("2026-05-01");
		expect(script).toContain("2026-05-31");
	});

	it("should map event data to CalendarEvent shape", async () => {
		const mockEvent = {
			id: "evt-1",
			title: "Team Standup",
			location: "Room A",
			notes: "Weekly sync",
			startDate: "2026-04-15T09:00:00.000Z",
			endDate: "2026-04-15T09:30:00.000Z",
			calendarName: "Work",
			isAllDay: false,
			url: "https://example.com",
		};

		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce([mockEvent]);

		const result = await calendarModule.getEvents();

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("evt-1");
		expect(result[0].title).toBe("Team Standup");
		expect(result[0].location).toBe("Room A");
		expect(result[0].notes).toBe("Weekly sync");
		expect(result[0].calendarName).toBe("Work");
		expect(result[0].isAllDay).toBe(false);
		expect(result[0].url).toBe("https://example.com");
	});

	it("should handle non-array result gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("unexpected string");

		const result = await calendarModule.getEvents();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await calendarModule.getEvents();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await calendarModule.getEvents();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should fill in defaults for missing event fields", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce([{}]); // event with no fields

		const result = await calendarModule.getEvents();

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Untitled Event");
		expect(result[0].calendarName).toBe("Unknown Calendar");
		expect(result[0].location).toBeNull();
		expect(result[0].notes).toBeNull();
		expect(result[0].startDate).toBeNull();
		expect(result[0].endDate).toBeNull();
		expect(result[0].isAllDay).toBe(false);
		expect(result[0].url).toBeNull();
	});
});

// ─── searchEvents ───────────────────────────────────────────────────────────

describe("calendar.searchEvents", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return events array on success", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce([]);

		const result = await calendarModule.searchEvents("meeting");

		expect(Array.isArray(result)).toBe(true);
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
	});

	it("should pass custom date range into the script", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce([]);

		await calendarModule.searchEvents("standup", 10, "2026-06-01", "2026-06-30");

		// The access check is call[0], the search script is call[1]
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
	});

	it("should map returned event data correctly", async () => {
		const mockEvent = {
			id: "search-evt-1",
			title: "Design Review",
			location: "Zoom",
			notes: "Review Q3 designs",
			startDate: "2026-04-20T14:00:00.000Z",
			endDate: "2026-04-20T15:00:00.000Z",
			calendarName: "Work",
			isAllDay: false,
			url: null,
		};

		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce([mockEvent]);

		const result = await calendarModule.searchEvents("design");

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("search-evt-1");
		expect(result[0].title).toBe("Design Review");
		expect(result[0].location).toBe("Zoom");
	});

	it("should return empty array for no matches", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce([]);

		const result = await calendarModule.searchEvents("nonexistent-query-xyz");

		expect(result).toHaveLength(0);
	});

	it("should handle non-array result gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("not an array");

		const result = await calendarModule.searchEvents("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await calendarModule.searchEvents("meeting");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await calendarModule.searchEvents("meeting");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── createEvent ────────────────────────────────────────────────────────────

describe("calendar.createEvent", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should create an event successfully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar") // access check
			.mockResolvedValueOnce("new-uid-abc"); // create script returns uid

		const result = await calendarModule.createEvent(
			"Lunch with Alice",
			"2026-04-20T12:00:00.000Z",
			"2026-04-20T13:00:00.000Z",
		);

		expect(result.success).toBe(true);
		expect(result.message).toContain("Lunch with Alice");
		expect(result.message).toContain("created successfully");
		expect(result.eventId).toBe("new-uid-abc");
	});

	it("should pass location and notes into the script", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("uid-123");

		await calendarModule.createEvent(
			"Team Offsite",
			"2026-05-01T09:00:00.000Z",
			"2026-05-01T17:00:00.000Z",
			"HQ Conference Room",
			"Bring presentations",
		);

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("Team Offsite");
		expect(script).toContain("HQ Conference Room");
		expect(script).toContain("Bring presentations");
	});

	it("should support all-day events", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("uid-allday");

		const result = await calendarModule.createEvent(
			"Company Holiday",
			"2026-12-25T00:00:00.000Z",
			"2026-12-26T00:00:00.000Z",
			undefined,
			undefined,
			true,
		);

		expect(result.success).toBe(true);
		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("allday event:true");
	});

	it("should use specified calendar name", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("uid-cal");

		await calendarModule.createEvent(
			"Personal Errand",
			"2026-04-20T10:00:00.000Z",
			"2026-04-20T11:00:00.000Z",
			undefined,
			undefined,
			false,
			"Personal",
		);

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain('calendar "Personal"');
	});

	it("should reject empty title", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar"); // access check passes

		const result = await calendarModule.createEvent(
			"  ",
			"2026-04-20T12:00:00.000Z",
			"2026-04-20T13:00:00.000Z",
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("title cannot be empty");
	});

	it("should reject invalid start date", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");

		const result = await calendarModule.createEvent(
			"Test Event",
			"not-a-date",
			"2026-04-20T13:00:00.000Z",
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("Invalid date format");
	});

	it("should reject invalid end date", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");

		const result = await calendarModule.createEvent(
			"Test Event",
			"2026-04-20T12:00:00.000Z",
			"garbage",
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("Invalid date format");
	});

	it("should reject end date before start date", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");

		const result = await calendarModule.createEvent(
			"Test Event",
			"2026-04-20T14:00:00.000Z",
			"2026-04-20T12:00:00.000Z",
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("End date must be after start date");
	});

	it("should reject end date equal to start date", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");

		const result = await calendarModule.createEvent(
			"Test Event",
			"2026-04-20T12:00:00.000Z",
			"2026-04-20T12:00:00.000Z",
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("End date must be after start date");
	});

	it("should handle access denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await calendarModule.createEvent(
			"Test Event",
			"2026-04-20T12:00:00.000Z",
			"2026-04-20T13:00:00.000Z",
		);

		expect(result.success).toBe(false);
	});

	it("should handle AppleScript error during creation", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockRejectedValueOnce(new Error("calendar not found"));

		const result = await calendarModule.createEvent(
			"Test Event",
			"2026-04-20T12:00:00.000Z",
			"2026-04-20T13:00:00.000Z",
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("calendar not found");
	});

	it("should escape double quotes in title", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("uid-quotes");

		await calendarModule.createEvent(
			'Meeting with "Bob"',
			"2026-04-20T12:00:00.000Z",
			"2026-04-20T13:00:00.000Z",
		);

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain('Meeting with \\"Bob\\"');
	});
});

// ─── openEvent ──────────────────────────────────────────────────────────────

describe("calendar.openEvent", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should open an event successfully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar") // access check
			.mockResolvedValueOnce("Calendar app opened (event search too slow)"); // open script

		const result = await calendarModule.openEvent("real-event-uid-abc");

		expect(result.success).toBe(true);
		expect(result.message).toContain("Calendar app opened");
	});

	it("should return failure for non-existent event ID", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("Calendar app opened (event search too slow)");

		const result = await calendarModule.openEvent("non-existent-event-id");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Event not found");
	});

	it("should return failure for event ID containing 12345", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockResolvedValueOnce("Calendar app opened (event search too slow)");

		const result = await calendarModule.openEvent("event-12345-test");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Event not found");
	});

	it("should handle access denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await calendarModule.openEvent("some-event-uid");

		expect(result.success).toBe(false);
		expect(result.message).toContain("access");
	});

	it("should handle AppleScript error when opening", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Calendar")
			.mockRejectedValueOnce(new Error("could not activate Calendar"));

		const result = await calendarModule.openEvent("some-event-uid");

		expect(result.success).toBe(false);
		expect(result.message).toContain("could not activate Calendar");
	});
});

// ─── requestCalendarAccess ──────────────────────────────────────────────────

describe("calendar.requestCalendarAccess", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return hasAccess true when Calendar app responds", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");

		const result = await calendarModule.requestCalendarAccess();

		expect(result.hasAccess).toBe(true);
		expect(result.message).toContain("already granted");
	});

	it("should return hasAccess false when Calendar app throws", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await calendarModule.requestCalendarAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Calendar access is required");
	});

	it("should include setup instructions when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await calendarModule.requestCalendarAccess();

		expect(result.message).toContain("System Settings");
		expect(result.message).toContain("Privacy & Security");
		expect(result.message).toContain("Automation");
	});
});
