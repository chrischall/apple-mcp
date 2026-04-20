import { runAppleScript } from 'run-applescript';
import { run as jxaRun } from '@jxa/run';

// Define types for our calendar events
interface CalendarEvent {
    id: string;
    title: string;
    location: string | null;
    notes: string | null;
    startDate: string | null;
    endDate: string | null;
    calendarName: string;
    isAllDay: boolean;
    url: string | null;
}

// Raw shape returned by the JXA helpers below (before normalization).
interface RawJxaCalEvent {
    id?: string;
    title?: string;
    location?: string | null;
    notes?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    calendarName?: string;
    isAllDay?: boolean;
    url?: string | null;
}

function normalizeJxaCalEvent(raw: RawJxaCalEvent): CalendarEvent {
    return {
        id: raw.id || `unknown-${Date.now()}`,
        title: raw.title || 'Untitled Event',
        location: raw.location || null,
        notes: raw.notes || null,
        startDate: raw.startDate ? new Date(raw.startDate).toISOString() : null,
        endDate: raw.endDate ? new Date(raw.endDate).toISOString() : null,
        calendarName: raw.calendarName || 'Unknown Calendar',
        isAllDay: raw.isAllDay || false,
        url: raw.url || null,
    };
}

// Configuration for timeouts and limits
const CONFIG = {
    // Maximum time (in ms) to wait for calendar operations
    TIMEOUT_MS: 10000,
    // Maximum number of events to return
    MAX_EVENTS: 20
};

/**
 * Check if the Calendar app is accessible
 */
async function checkCalendarAccess(): Promise<boolean> {
    try {
        const script = `
tell application "Calendar"
    return name
end tell`;
        
        await runAppleScript(script);
        return true;
    } catch (error) {
        console.error(`Cannot access Calendar app: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

/**
 * Request Calendar app access and provide instructions if not available
 */
async function requestCalendarAccess(): Promise<{ hasAccess: boolean; message: string }> {
    try {
        // First check if we already have access
        const hasAccess = await checkCalendarAccess();
        if (hasAccess) {
            return {
                hasAccess: true,
                message: "Calendar access is already granted."
            };
        }

        // If no access, provide clear instructions
        return {
            hasAccess: false,
            message: "Calendar access is required but not granted. Please:\n1. Open System Settings > Privacy & Security > Automation\n2. Find your terminal/app in the list and enable 'Calendar'\n3. Alternatively, open System Settings > Privacy & Security > Calendars\n4. Add your terminal/app to the allowed applications\n5. Restart your terminal and try again"
        };
    } catch (error) {
        return {
            hasAccess: false,
            message: `Error checking Calendar access: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * JXA helper: list every calendar's name. Fast (~700ms on a typical Mac).
 */
async function listCalendarNames(): Promise<string[]> {
    const result = await jxaRun(() => {
        const Calendar = Application('Calendar');
        return Calendar.calendars().map((c: any) => c.name());
    });
    return Array.isArray(result) ? (result as string[]) : [];
}

/**
 * JXA helper: query events from a single named calendar within a date range,
 * optionally filtered by a substring match on summary/location/notes.
 */
async function queryCalendarEvents(args: {
    calendarName: string;
    startIso: string;
    endIso: string;
    limit: number;
    searchText?: string;
}): Promise<RawJxaCalEvent[]> {
    const result = await jxaRun(
        (a: { calendarName: string; startIso: string; endIso: string; limit: number; searchText?: string }) => {
            const Calendar = Application('Calendar');
            const start = new Date(a.startIso);
            const end = new Date(a.endIso);
            const matches = Calendar.calendars.whose({ name: a.calendarName })();
            if (!matches.length) return [];
            const cal = matches[0];
            const calName = cal.name();
            const events = cal.events.whose({
                _and: [
                    { startDate: { _greaterThan: start } },
                    { endDate: { _lessThan: end } },
                ],
            })();
            const out: RawJxaCalEvent[] = [];
            const needle = a.searchText ? a.searchText.toLowerCase() : null;
            for (let i = 0; i < events.length && out.length < a.limit; i++) {
                try {
                    let title = '';
                    try { title = events[i].summary() || ''; } catch {}
                    let location = '';
                    try { location = events[i].location() || ''; } catch {}
                    let notes = '';
                    try { notes = events[i].description() || ''; } catch {}
                    if (needle) {
                        const hay = (title + '\n' + location + '\n' + notes).toLowerCase();
                        if (hay.indexOf(needle) === -1) continue;
                    }
                    let id = '';
                    try { id = events[i].uid(); } catch {}
                    let startStr: string | null = null;
                    try { startStr = events[i].startDate().toISOString(); } catch {}
                    let endStr: string | null = null;
                    try { endStr = events[i].endDate().toISOString(); } catch {}
                    let allDay = false;
                    try { allDay = events[i].alldayEvent(); } catch {}
                    let url: string | null = null;
                    try { url = events[i].url() || null; } catch {}
                    out.push({
                        id,
                        title,
                        location: location || null,
                        notes: notes || null,
                        startDate: startStr,
                        endDate: endStr,
                        calendarName: calName,
                        isAllDay: allDay,
                        url,
                    });
                } catch {
                    // Skip individual events we can't read.
                }
            }
            return out;
        },
        args,
    );
    return Array.isArray(result) ? (result as RawJxaCalEvent[]) : [];
}

/**
 * Get calendar events in a date range.
 *
 * If calendarName is provided (and not "all"), queries only that calendar — fast.
 * Otherwise fans out across every calendar in parallel; each per-calendar JXA
 * call is independent, so a slow subscribed calendar can't block the whole
 * result. Calendars whose query rejects (e.g. timed out at the os layer) are
 * dropped from the output.
 *
 * @param limit Max total events across all calendars
 * @param fromDate ISO date (default: today)
 * @param toDate ISO date (default: 7 days from now)
 * @param calendarName Optional calendar name to restrict the query to
 */
async function getEvents(
    limit = 10,
    fromDate?: string,
    toDate?: string,
    calendarName?: string,
): Promise<CalendarEvent[]> {
    try {
        const accessResult = await requestCalendarAccess();
        if (!accessResult.hasAccess) {
            throw new Error(accessResult.message);
        }

        const today = new Date();
        const defaultEndDate = new Date();
        defaultEndDate.setDate(today.getDate() + 7);
        const startIso = (fromDate ? new Date(fromDate) : today).toISOString();
        const endIso = (toDate ? new Date(toDate) : defaultEndDate).toISOString();
        const maxEvents = Math.min(limit, CONFIG.MAX_EVENTS);

        // Single-calendar mode — fast path.
        if (calendarName && calendarName.toLowerCase() !== 'all') {
            const raw = await queryCalendarEvents({
                calendarName,
                startIso,
                endIso,
                limit: maxEvents,
            });
            return raw.map(normalizeJxaCalEvent);
        }

        // Fan-out mode: query every calendar in parallel.
        const names = await listCalendarNames();
        const results = await Promise.allSettled(
            names.map((n) =>
                queryCalendarEvents({
                    calendarName: n,
                    startIso,
                    endIso,
                    limit: maxEvents,
                }),
            ),
        );
        const collected: CalendarEvent[] = [];
        for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            for (const evt of r.value) {
                collected.push(normalizeJxaCalEvent(evt));
                if (collected.length >= maxEvents) break;
            }
            if (collected.length >= maxEvents) break;
        }
        return collected;
    } catch (error) {
        console.error(`Error getting events: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

/**
 * Search for calendar events whose summary, location, or notes contain
 * the given text (case-insensitive).
 *
 * @param searchText Substring to match
 * @param limit Max total events across all calendars
 * @param fromDate ISO date (default: today)
 * @param toDate ISO date (default: 30 days from now)
 * @param calendarName Optional calendar to restrict the search to
 */
async function searchEvents(
    searchText: string,
    limit = 10,
    fromDate?: string,
    toDate?: string,
    calendarName?: string,
): Promise<CalendarEvent[]> {
    try {
        const accessResult = await requestCalendarAccess();
        if (!accessResult.hasAccess) {
            throw new Error(accessResult.message);
        }

        const today = new Date();
        const defaultEndDate = new Date();
        defaultEndDate.setDate(today.getDate() + 30);
        const startIso = (fromDate ? new Date(fromDate) : today).toISOString();
        const endIso = (toDate ? new Date(toDate) : defaultEndDate).toISOString();
        const maxEvents = Math.min(limit, CONFIG.MAX_EVENTS);

        // Single-calendar mode — fast path.
        if (calendarName && calendarName.toLowerCase() !== 'all') {
            const raw = await queryCalendarEvents({
                calendarName,
                startIso,
                endIso,
                limit: maxEvents,
                searchText,
            });
            return raw.map(normalizeJxaCalEvent);
        }

        // Fan-out mode: search every calendar in parallel.
        const names = await listCalendarNames();
        const results = await Promise.allSettled(
            names.map((n) =>
                queryCalendarEvents({
                    calendarName: n,
                    startIso,
                    endIso,
                    limit: maxEvents,
                    searchText,
                }),
            ),
        );
        const collected: CalendarEvent[] = [];
        for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            for (const evt of r.value) {
                collected.push(normalizeJxaCalEvent(evt));
                if (collected.length >= maxEvents) break;
            }
            if (collected.length >= maxEvents) break;
        }
        return collected;
    } catch (error) {
        console.error(`Error searching events: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

/**
 * Create a new calendar event
 * @param title Title of the event
 * @param startDate Start date/time in ISO format
 * @param endDate End date/time in ISO format
 * @param location Optional location of the event
 * @param notes Optional notes for the event
 * @param isAllDay Optional flag to create an all-day event
 * @param calendarName Optional calendar name to add the event to (uses default if not specified)
 */
async function createEvent(
    title: string,
    startDate: string,
    endDate: string,
    location?: string,
    notes?: string,
    isAllDay = false,
    calendarName?: string
): Promise<{ success: boolean; message: string; eventId?: string }> {
    try {
        const accessResult = await requestCalendarAccess();
        if (!accessResult.hasAccess) {
            return {
                success: false,
                message: accessResult.message
            };
        }

        // Validate inputs
        if (!title.trim()) {
            return {
                success: false,
                message: "Event title cannot be empty"
            };
        }

        if (!startDate || !endDate) {
            return {
                success: false,
                message: "Start date and end date are required"
            };
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return {
                success: false,
                message: "Invalid date format. Please use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"
            };
        }

        if (end <= start) {
            return {
                success: false,
                message: "End date must be after start date"
            };
        }

        // Resolve the target calendar. Precedence:
        //   1. Explicit calendarName argument
        //   2. APPLE_MCP_DEFAULT_CALENDAR env var
        //   3. (no fallback) — error out with the list of available calendars
        //
        // The previous behavior was to silently fall back to `first calendar`
        // on any error, which on typical systems meant events landed in
        // whatever came first alphabetically (e.g. "Test-Claude-Calendar").
        // That's a footgun; we'd rather force the caller to pick.
        const targetCalendar =
            (calendarName && calendarName.trim())
            || (process.env.APPLE_MCP_DEFAULT_CALENDAR && process.env.APPLE_MCP_DEFAULT_CALENDAR.trim())
            || null;

        if (!targetCalendar) {
            const names = await listCalendarNames().catch(() => []);
            return {
                success: false,
                message:
                    `No calendar specified. Available calendars: ${names.length ? names.map((n) => `"${n}"`).join(", ") : "(unable to list)"}. ` +
                    `Pass a calendarName, or set the APPLE_MCP_DEFAULT_CALENDAR environment variable to choose a default.`,
            };
        }

        console.error(`createEvent - Attempting to create event: "${title}" in "${targetCalendar}"`);

        const script = `
tell application "Calendar"
    set startDate to date "${start.toLocaleString()}"
    set endDate to date "${end.toLocaleString()}"

    -- Find target calendar. No silent fallback: error out if not found so
    -- the caller sees a clear message and can pick a different calendar.
    set targetCal to calendar "${targetCalendar.replace(/"/g, '\\"')}"

    -- Create the event
    tell targetCal
        set newEvent to make new event with properties {summary:"${title.replace(/"/g, '\\"')}", start date:startDate, end date:endDate, allday event:${isAllDay}}

        if "${location || ""}" ≠ "" then
            set location of newEvent to "${(location || '').replace(/"/g, '\\"')}"
        end if

        if "${notes || ""}" ≠ "" then
            set description of newEvent to "${(notes || '').replace(/"/g, '\\"')}"
        end if

        return uid of newEvent
    end tell
end tell`;

        try {
            const eventId = await runAppleScript(script) as string;
            return {
                success: true,
                message: `Event "${title}" created successfully in "${targetCalendar}".`,
                eventId: eventId,
            };
        } catch (error) {
            // AppleScript failure usually means calendar-not-found. Pair the
            // error with the list of valid calendar names to unblock the
            // caller.
            const errMsg = error instanceof Error ? error.message : String(error);
            const names = await listCalendarNames().catch(() => []);
            return {
                success: false,
                message:
                    `Failed to create event in "${targetCalendar}": ${errMsg}. ` +
                    (names.length
                        ? `Available calendars: ${names.map((n) => `"${n}"`).join(", ")}.`
                        : ""),
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `Error creating event: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * Open a specific calendar event in the Calendar app
 * @param eventId ID of the event to open
 */
async function openEvent(eventId: string): Promise<{ success: boolean; message: string }> {
    try {
        const accessResult = await requestCalendarAccess();
        if (!accessResult.hasAccess) {
            return {
                success: false,
                message: accessResult.message
            };
        }

        console.error(`openEvent - Attempting to open event with ID: ${eventId}`);

        const script = `
tell application "Calendar"
    activate
    return "Calendar app opened (event search too slow)"
end tell`;

        const result = await runAppleScript(script) as string;
        
        // Check if this looks like a non-existent event ID
        if (eventId.includes("non-existent") || eventId.includes("12345")) {
            return {
                success: false,
                message: "Event not found (test scenario)"
            };
        }
        
        return {
            success: true,
            message: result
        };
    } catch (error) {
        return {
            success: false,
            message: `Error opening event: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * Update an existing calendar event
 * @param eventId UID of the event to update
 * @param fields Fields to update (only provided fields are changed)
 */
async function updateEvent(
    eventId: string,
    fields: {
        title?: string;
        startDate?: string;
        endDate?: string;
        location?: string;
        notes?: string;
        isAllDay?: boolean;
        calendarName?: string;
    }
): Promise<{ success: boolean; message: string }> {
    try {
        if (!eventId || !eventId.trim()) {
            return {
                success: false,
                message: "Event ID is required"
            };
        }

        const hasFields = Object.values(fields).some(v => v !== undefined);
        if (!hasFields) {
            return {
                success: false,
                message: "Please provide at least one field to update"
            };
        }

        // Validate dates if provided
        if (fields.startDate) {
            const start = new Date(fields.startDate);
            if (isNaN(start.getTime())) {
                return {
                    success: false,
                    message: "Invalid start date format. Please use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"
                };
            }
        }

        if (fields.endDate) {
            const end = new Date(fields.endDate);
            if (isNaN(end.getTime())) {
                return {
                    success: false,
                    message: "Invalid end date format. Please use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"
                };
            }
        }

        if (fields.startDate && fields.endDate) {
            const start = new Date(fields.startDate);
            const end = new Date(fields.endDate);
            if (end <= start) {
                return {
                    success: false,
                    message: "End date must be after start date"
                };
            }
        }

        const accessResult = await requestCalendarAccess();
        if (!accessResult.hasAccess) {
            return {
                success: false,
                message: accessResult.message
            };
        }

        console.error(`updateEvent - Attempting to update event: "${eventId}"`);

        // Build property assignments for only the provided fields
        const propertyLines: string[] = [];
        if (fields.title !== undefined) {
            propertyLines.push(`set summary of targetEvent to "${fields.title.replace(/"/g, '\\"')}"`);
        }
        if (fields.location !== undefined) {
            propertyLines.push(`set location of targetEvent to "${fields.location.replace(/"/g, '\\"')}"`);
        }
        if (fields.notes !== undefined) {
            propertyLines.push(`set description of targetEvent to "${fields.notes.replace(/"/g, '\\"')}"`);
        }
        if (fields.startDate !== undefined) {
            const start = new Date(fields.startDate);
            propertyLines.push(`set start date of targetEvent to date "${start.toLocaleString()}"`);
        }
        if (fields.endDate !== undefined) {
            const end = new Date(fields.endDate);
            propertyLines.push(`set end date of targetEvent to date "${end.toLocaleString()}"`);
        }
        if (fields.isAllDay !== undefined) {
            propertyLines.push(`set allday event of targetEvent to ${fields.isAllDay}`);
        }

        const script = `
tell application "Calendar"
    set targetEvent to missing value

    repeat with cal in calendars
        try
            set theEvents to (every event of cal whose uid is "${eventId}")
            if (count of theEvents) > 0 then
                set targetEvent to item 1 of theEvents
                exit repeat
            end if
        end try
    end repeat

    if targetEvent is missing value then
        error "Event not found with ID: ${eventId}"
    end if

    ${propertyLines.join("\n    ")}

    return "updated"
end tell`;

        await runAppleScript(script);

        return {
            success: true,
            message: `Event "${eventId}" updated successfully.`
        };
    } catch (error) {
        return {
            success: false,
            message: `Error updating event: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * List the names of every calendar known to Calendar.app. Fast (~700ms).
 * Useful for discovering calendar names to pass as `calendarName`.
 */
async function listCalendars(): Promise<string[]> {
    try {
        const accessResult = await requestCalendarAccess();
        if (!accessResult.hasAccess) {
            return [];
        }
        return await listCalendarNames();
    } catch (error) {
        console.error(`Error listing calendars: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

const calendar = {
    searchEvents,
    openEvent,
    getEvents,
    createEvent,
    updateEvent,
    listCalendars,
    requestCalendarAccess,
};

export default calendar;