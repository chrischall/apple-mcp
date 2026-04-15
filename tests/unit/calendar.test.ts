import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Mock @jxa/run for the data-fetch path. Each test queues responses with
// mockJxaRun.mockResolvedValueOnce(...) for each `run()` call. The callback
// passed to run() is never executed in tests; we just resolve with a fake
// value the callback would have produced.
const mockJxaRun = mock(() => Promise.resolve(undefined as unknown));
mock.module("@jxa/run", () => ({
	run: mockJxaRun,
}));

// Import after mocking
const calendarModule = (await import("../../utils/calendar.js")).default;

// ─── getEvents ──────────────────────────────────────────────────────────────

describe("calendar.getEvents", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
		mockJxaRun.mockReset();
	});

	it("should return parsed events from a single calendar when calendarName is given", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar"); // access check
		mockJxaRun.mockResolvedValueOnce([
			{
				id: "evt-1",
				title: "Team Standup",
				location: "Room A",
				notes: "Weekly sync",
				startDate: "2026-04-15T09:00:00.000Z",
				endDate: "2026-04-15T09:30:00.000Z",
				calendarName: "Work",
				isAllDay: false,
				url: "https://example.com",
			},
		]);

		const result = await calendarModule.getEvents(10, undefined, undefined, "Work");

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Team Standup");
		expect(result[0].calendarName).toBe("Work");
		expect(result[0].location).toBe("Room A");
		// One JXA call for the single named calendar (no calendar-listing call)
		expect(mockJxaRun).toHaveBeenCalledTimes(1);
		const callArgs = mockJxaRun.mock.calls[0][1] as { calendarName?: string };
		expect(callArgs.calendarName).toBe("Work");
	});

	it("should pass the date range through to JXA as ISO strings", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce([]);

		await calendarModule.getEvents(5, "2026-05-01", "2026-05-31", "Work");

		const callArgs = mockJxaRun.mock.calls[0][1] as { startIso: string; endIso: string };
		expect(callArgs.startIso).toContain("2026-05-01");
		expect(callArgs.endIso).toContain("2026-05-31");
	});

	it("should fan out across all calendars when no calendarName is given", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		// First JXA call returns the calendar list.
		mockJxaRun.mockResolvedValueOnce(["Personal", "Work", "Family"]);
		// Then one JXA call per calendar — return one event per calendar.
		mockJxaRun.mockResolvedValueOnce([{ id: "p1", title: "Lunch", calendarName: "Personal", startDate: "2026-04-15T12:00:00.000Z", endDate: "2026-04-15T13:00:00.000Z" }]);
		mockJxaRun.mockResolvedValueOnce([{ id: "w1", title: "Standup", calendarName: "Work", startDate: "2026-04-16T09:00:00.000Z", endDate: "2026-04-16T09:15:00.000Z" }]);
		mockJxaRun.mockResolvedValueOnce([{ id: "f1", title: "Dinner", calendarName: "Family", startDate: "2026-04-17T18:00:00.000Z", endDate: "2026-04-17T19:00:00.000Z" }]);

		const result = await calendarModule.getEvents(10);

		expect(result).toHaveLength(3);
		const titles = result.map((e) => e.title).sort();
		expect(titles).toEqual(["Dinner", "Lunch", "Standup"]);
		// 1 list call + 3 per-calendar calls = 4 total JXA calls
		expect(mockJxaRun).toHaveBeenCalledTimes(4);
	});

	it("should respect the limit across fanned-out calendars", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce(["A", "B"]);
		mockJxaRun.mockResolvedValueOnce([
			{ id: "a1", title: "T1", calendarName: "A", startDate: "2026-04-15T01:00:00.000Z", endDate: "2026-04-15T02:00:00.000Z" },
			{ id: "a2", title: "T2", calendarName: "A", startDate: "2026-04-15T03:00:00.000Z", endDate: "2026-04-15T04:00:00.000Z" },
		]);
		mockJxaRun.mockResolvedValueOnce([
			{ id: "b1", title: "T3", calendarName: "B", startDate: "2026-04-15T05:00:00.000Z", endDate: "2026-04-15T06:00:00.000Z" },
		]);

		const result = await calendarModule.getEvents(2);

		expect(result).toHaveLength(2);
	});

	it("should skip calendars whose JXA call rejects but keep the rest", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce(["Slow", "Fast"]);
		mockJxaRun.mockRejectedValueOnce(new Error("calendar timed out"));
		mockJxaRun.mockResolvedValueOnce([
			{ id: "f1", title: "OK", calendarName: "Fast", startDate: "2026-04-15T09:00:00.000Z", endDate: "2026-04-15T10:00:00.000Z" },
		]);

		const result = await calendarModule.getEvents(10);

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("OK");
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await calendarModule.getEvents();

		expect(result).toHaveLength(0);
		expect(mockJxaRun).not.toHaveBeenCalled();
	});

	it("should handle non-array result from JXA gracefully", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce("unexpected" as unknown);

		const result = await calendarModule.getEvents(10, undefined, undefined, "Work");

		expect(result).toHaveLength(0);
	});

	it("should fill defaults for missing event fields", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce([{}]);

		const result = await calendarModule.getEvents(10, undefined, undefined, "Work");

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
		mockJxaRun.mockReset();
	});

	it("should return matching events from a single calendar when calendarName is given", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce([
			{
				id: "search-evt-1",
				title: "Design Review",
				location: "Zoom",
				notes: "Review Q3 designs",
				startDate: "2026-04-20T14:00:00.000Z",
				endDate: "2026-04-20T15:00:00.000Z",
				calendarName: "Work",
				isAllDay: false,
				url: null,
			},
		]);

		const result = await calendarModule.searchEvents("design", 10, undefined, undefined, "Work");

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Design Review");
		expect(mockJxaRun).toHaveBeenCalledTimes(1);
		const callArgs = mockJxaRun.mock.calls[0][1] as { searchText: string; calendarName?: string };
		expect(callArgs.searchText).toBe("design");
		expect(callArgs.calendarName).toBe("Work");
	});

	it("should fan out across all calendars when no calendarName is given", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce(["Personal", "Work"]);
		mockJxaRun.mockResolvedValueOnce([]);
		mockJxaRun.mockResolvedValueOnce([
			{ id: "w1", title: "Sprint Standup", calendarName: "Work", startDate: "2026-04-21T09:00:00.000Z", endDate: "2026-04-21T09:15:00.000Z" },
		]);

		const result = await calendarModule.searchEvents("standup");

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Sprint Standup");
		// 1 list + 2 per-calendar = 3 total
		expect(mockJxaRun).toHaveBeenCalledTimes(3);
	});

	it("should pass the search term to every per-calendar JXA call", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce(["A", "B"]);
		mockJxaRun.mockResolvedValueOnce([]);
		mockJxaRun.mockResolvedValueOnce([]);

		await calendarModule.searchEvents("standup");

		// calls[0] is the calendar-list call, no searchText
		const a = mockJxaRun.mock.calls[1][1] as { searchText: string };
		const b = mockJxaRun.mock.calls[2][1] as { searchText: string };
		expect(a.searchText).toBe("standup");
		expect(b.searchText).toBe("standup");
	});

	it("should skip calendars whose JXA call rejects but keep the rest", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce(["Slow", "Fast"]);
		mockJxaRun.mockRejectedValueOnce(new Error("timeout"));
		mockJxaRun.mockResolvedValueOnce([
			{ id: "f1", title: "Sync", calendarName: "Fast", startDate: "2026-04-22T09:00:00.000Z", endDate: "2026-04-22T09:15:00.000Z" },
		]);

		const result = await calendarModule.searchEvents("sync");

		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Sync");
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await calendarModule.searchEvents("meeting");

		expect(result).toHaveLength(0);
		expect(mockJxaRun).not.toHaveBeenCalled();
	});

	it("should handle non-array result gracefully", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Calendar");
		mockJxaRun.mockResolvedValueOnce("not an array" as unknown);

		const result = await calendarModule.searchEvents("test", 10, undefined, undefined, "Work");

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
