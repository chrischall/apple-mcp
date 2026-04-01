// tests/integration/calendar.test.ts
import { describe, it, expect } from "bun:test";
import calendarModule from "../../utils/calendar.js";

describe("calendar_list_calendars / listCalendars", () => {
  it("returns array of Calendar objects", async () => {
    const cals = await calendarModule.listCalendars();
    expect(Array.isArray(cals)).toBe(true);
    for (const c of cals) {
      expect(typeof c.name).toBe("string");
      expect(typeof c.writable).toBe("boolean");
    }
    console.log(`Found ${cals.length} calendars`);
  }, 15000);
});

describe("calendar_list / listEvents", () => {
  it("returns array with correct shape (no args)", async () => {
    const events = await calendarModule.listEvents({});
    expect(Array.isArray(events)).toBe(true);
    for (const e of events) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.title).toBe("string");
      expect(e.startDate instanceof Date).toBe(true);
      expect(e.endDate instanceof Date).toBe(true);
      expect(typeof e.calendarName).toBe("string");
      expect(typeof e.isAllDay).toBe("boolean");
    }
    console.log(`listEvents returned ${events.length} events`);
  }, 20000);

  it("respects limit param", async () => {
    const events = await calendarModule.listEvents({ limit: 2 });
    expect(events.length).toBeLessThanOrEqual(2);
  }, 20000);
});

describe("calendar_search / searchEvents", () => {
  it("returns array", async () => {
    const events = await calendarModule.searchEvents({ query: "meeting" });
    expect(Array.isArray(events)).toBe(true);
  }, 20000);

  it("returns empty array for impossible query", async () => {
    const events = await calendarModule.searchEvents({ query: "ZzZzImpossibleQuery99991" });
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);
  }, 20000);
});

describe("calendar_get / getEvent", () => {
  it("returns null for non-existent id", async () => {
    const result = await calendarModule.getEvent("fake-uid-that-does-not-exist-99999");
    expect(result).toBeNull();
  }, 90000);

  it("returns event with attendees array for real event if one exists", async () => {
    const events = await calendarModule.listEvents({ limit: 1 });
    if (events.length === 0) { console.log("No events available"); return; }
    const event = await calendarModule.getEvent(events[0].id);
    if (event) {
      expect(typeof event.id).toBe("string");
      expect(typeof event.title).toBe("string");
      expect(event.startDate instanceof Date).toBe(true);
      expect(Array.isArray(event.attendees)).toBe(true);
    }
  }, 45000);
});

describe("calendar_create / createEvent", () => {
  it("returns boolean", async () => {
    const result = await calendarModule.createEvent({
      title: `MCP Test Event ${Date.now()}`,
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 7200000).toISOString(),
    });
    expect(typeof result).toBe("boolean");
    console.log(`createEvent result: ${result}`);
  }, 20000);

  it("returns false for empty title", async () => {
    const result = await calendarModule.createEvent({
      title: "",
      startDate: new Date(Date.now() + 3600000).toISOString(),
      endDate: new Date(Date.now() + 7200000).toISOString(),
    });
    expect(result).toBe(false);
  }, 5000);

  it("returns false when endDate <= startDate", async () => {
    const now = new Date().toISOString();
    const result = await calendarModule.createEvent({
      title: "Bad Dates",
      startDate: now,
      endDate: now,
    });
    expect(result).toBe(false);
  }, 5000);
});

describe("calendar_update / updateEvent", () => {
  it("returns false for non-existent id", async () => {
    const result = await calendarModule.updateEvent({
      id: "fake-uid-that-does-not-exist-99999",
      title: "Updated",
    });
    expect(result).toBe(false);
  }, 90000);

  it("returns false when no fields to update", async () => {
    const result = await calendarModule.updateEvent({ id: "some-id" });
    expect(result).toBe(false);
  }, 5000);
});

describe("calendar_delete / deleteEvent", () => {
  it("returns false for non-existent id", async () => {
    const result = await calendarModule.deleteEvent("fake-uid-that-does-not-exist-99999");
    expect(result).toBe(false);
  }, 90000);
});

describe("calendar_open / openEvent", () => {
  it("returns boolean", async () => {
    const events = await calendarModule.listEvents({ limit: 1 });
    if (events.length === 0) { console.log("No events to open"); return; }
    const result = await calendarModule.openEvent(events[0].id);
    expect(typeof result).toBe("boolean");
    console.log(`openEvent result: ${result}`);
  }, 20000);

  it("returns false for non-existent id", async () => {
    const result = await calendarModule.openEvent("fake-uid-that-does-not-exist-99999");
    expect(result).toBe(false);
  }, 90000);
});

describe("calendar_get_free_busy / getFreeBusy", () => {
  it("returns array of BusyBlock objects", async () => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const blocks = await calendarModule.getFreeBusy({
      startDate: now.toISOString(),
      endDate: nextWeek.toISOString(),
    });
    expect(Array.isArray(blocks)).toBe(true);
    for (const b of blocks) {
      expect(typeof b.title).toBe("string");
      expect(b.startDate instanceof Date).toBe(true);
      expect(b.endDate instanceof Date).toBe(true);
      expect(typeof b.calendarName).toBe("string");
    }
    console.log(`getFreeBusy returned ${blocks.length} busy blocks`);
  }, 20000);
});

describe("calendar_find_slots / findAvailableSlots", () => {
  it("returns array of AvailableSlot objects", async () => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const slots = await calendarModule.findAvailableSlots({
      startDate: now.toISOString(),
      endDate: nextWeek.toISOString(),
      durationMinutes: 60,
    });
    expect(Array.isArray(slots)).toBe(true);
    for (const s of slots) {
      expect(s.startDate instanceof Date).toBe(true);
      expect(s.endDate instanceof Date).toBe(true);
      // Each slot must be at least durationMinutes long
      const durationMs = s.endDate.getTime() - s.startDate.getTime();
      expect(durationMs).toBeGreaterThanOrEqual(60 * 60 * 1000);
    }
    console.log(`findAvailableSlots returned ${slots.length} slots`);
  }, 20000);

  it("returns empty array when range is too small for duration", async () => {
    const now = new Date();
    const inTenMinutes = new Date(now.getTime() + 10 * 60 * 1000);
    const slots = await calendarModule.findAvailableSlots({
      startDate: now.toISOString(),
      endDate: inTenMinutes.toISOString(),
      durationMinutes: 60,
    });
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBe(0);
  }, 20000);
});
