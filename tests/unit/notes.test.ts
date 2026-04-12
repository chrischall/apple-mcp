import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Import after mocking
const notesModule = (await import("../../utils/notes.js")).default;

// ─── requestNotesAccess ────────────────────────────────────────────────────

describe("notes.requestNotesAccess", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return hasAccess true when Notes app responds", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Notes");

		const result = await notesModule.requestNotesAccess();

		expect(result.hasAccess).toBe(true);
		expect(result.message).toContain("already granted");
	});

	it("should return hasAccess false when Notes app throws", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await notesModule.requestNotesAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Notes access is required");
	});

	it("should include setup instructions when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await notesModule.requestNotesAccess();

		expect(result.message).toContain("System Settings");
		expect(result.message).toContain("Privacy & Security");
		expect(result.message).toContain("Automation");
	});
});

// ─── getAllNotes ────────────────────────────────────────────────────────────

describe("notes.getAllNotes", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return notes array on success", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes") // access check
			.mockResolvedValueOnce([]); // getAllNotes script

		const result = await notesModule.getAllNotes();

		expect(Array.isArray(result)).toBe(true);
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
	});

	it("should map note data correctly", async () => {
		const mockNote = {
			name: "Shopping List",
			content: "Milk, eggs, bread",
		};

		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce([mockNote]);

		const result = await notesModule.getAllNotes();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Shopping List");
		expect(result[0].content).toBe("Milk, eggs, bread");
		expect(result[0].creationDate).toBeUndefined();
		expect(result[0].modificationDate).toBeUndefined();
	});

	it("should fill in defaults for missing note fields", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce([{}]);

		const result = await notesModule.getAllNotes();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Untitled Note");
		expect(result[0].content).toBe("");
	});

	it("should handle non-array result gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("unexpected string");

		const result = await notesModule.getAllNotes();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Untitled Note");
	});

	it("should return empty array for null result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce(null);

		const result = await notesModule.getAllNotes();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await notesModule.getAllNotes();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await notesModule.getAllNotes();

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// ─── findNote ──────────────────────────────────────────────────────────────

describe("notes.findNote", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return empty array for empty search text", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Notes"); // access check

		const result = await notesModule.findNote("");

		expect(result).toHaveLength(0);
	});

	it("should return empty array for whitespace-only search text", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Notes");

		const result = await notesModule.findNote("   ");

		expect(result).toHaveLength(0);
	});

	it("should return notes array on success", async () => {
		const mockNote = {
			name: "Meeting Notes",
			content: "Discussed roadmap",
		};

		mockRunAppleScript
			.mockResolvedValueOnce("Notes") // access check
			.mockResolvedValueOnce([mockNote]); // findNote script

		const result = await notesModule.findNote("meeting");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Meeting Notes");
		expect(result[0].content).toBe("Discussed roadmap");
	});

	it("should handle non-array result gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("not an array");

		const result = await notesModule.findNote("test");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(1);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await notesModule.findNote("meeting");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should return empty array when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await notesModule.findNote("meeting");

		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("should fill in defaults for missing note fields", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce([{}]);

		const result = await notesModule.findNote("something");

		expect(result[0].name).toBe("Untitled Note");
		expect(result[0].content).toBe("");
		expect(result[0].creationDate).toBeUndefined();
		expect(result[0].modificationDate).toBeUndefined();
	});
});

// ─── createNote ────────────────────────────────────────────────────────────

describe("notes.createNote", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should create a note successfully in a named folder", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes") // access check
			.mockResolvedValueOnce("SUCCESS:Claude:false"); // create script

		const result = await notesModule.createNote("My Note", "Some content", "Claude");

		expect(result.success).toBe(true);
		expect(result.note?.name).toBe("My Note");
		expect(result.note?.content).toBe("Some content");
		expect(result.folderName).toBe("Claude");
		expect(result.usedDefaultFolder).toBe(false);
	});

	it("should handle note created in default folder", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("SUCCESS:Notes:true");

		const result = await notesModule.createNote("My Note", "Content");

		expect(result.success).toBe(true);
		expect(result.folderName).toBe("Notes");
		expect(result.usedDefaultFolder).toBe(true);
	});

	it("should return failure for empty title", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Notes"); // access check

		const result = await notesModule.createNote("", "Some content");

		expect(result.success).toBe(false);
		expect(result.message).toContain("title cannot be empty");
	});

	it("should return failure for whitespace-only title", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Notes");

		const result = await notesModule.createNote("   ", "Some content");

		expect(result.success).toBe(false);
		expect(result.message).toContain("title cannot be empty");
	});

	it("should use a temp file path in the AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("SUCCESS:Claude:false");

		await notesModule.createNote("Test", "Body text", "Claude");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("/tmp/note-content-");
		expect(script).toContain(".txt");
	});

	it("should handle access denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await notesModule.createNote("Test", "Body");

		expect(result.success).toBe(false);
	});

	it("should handle AppleScript error during creation", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockRejectedValueOnce(new Error("folder not found"));

		const result = await notesModule.createNote("Test", "Body");

		expect(result.success).toBe(false);
		expect(result.message).toContain("folder not found");
	});

	it("should return failure when result does not start with SUCCESS", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("FAILURE:something went wrong");

		const result = await notesModule.createNote("Test", "Body");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Failed to create note");
	});

	it("should return failure when result is empty", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("");

		const result = await notesModule.createNote("Test", "Body");

		expect(result.success).toBe(false);
		expect(result.message).toContain("No result from AppleScript");
	});
});

// ─── getNotesFromFolder ────────────────────────────────────────────────────

describe("notes.getNotesFromFolder", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return success with empty notes on SUCCESS result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes") // access check
			.mockResolvedValueOnce("SUCCESS:0"); // folder script

		const result = await notesModule.getNotesFromFolder("Claude");

		expect(result.success).toBe(true);
		expect(result.notes).toEqual([]);
	});

	it("should return failure with message on ERROR result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("ERROR:Folder not found");

		const result = await notesModule.getNotesFromFolder("NonExistent");

		expect(result.success).toBe(false);
		expect(result.message).toBe("Folder not found");
	});

	it("should handle access denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await notesModule.getNotesFromFolder("Claude");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Notes access is required");
	});

	it("should handle AppleScript error", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await notesModule.getNotesFromFolder("Claude");

		expect(result.success).toBe(false);
		expect(result.message).toContain("script error");
	});

	it("should return success with empty notes for non-string result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce(null);

		const result = await notesModule.getNotesFromFolder("Claude");

		expect(result.success).toBe(true);
		expect(result.notes).toEqual([]);
	});
});

// ─── getRecentNotesFromFolder ──────────────────────────────────────────────

describe("notes.getRecentNotesFromFolder", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return success with notes sliced by limit", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes") // access check
			.mockResolvedValueOnce("SUCCESS:0"); // folder script

		const result = await notesModule.getRecentNotesFromFolder("Claude", 3);

		expect(result.success).toBe(true);
		expect(result.notes).toEqual([]);
	});

	it("should propagate failure from getNotesFromFolder", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("ERROR:Folder not found");

		const result = await notesModule.getRecentNotesFromFolder("NonExistent", 5);

		expect(result.success).toBe(false);
		expect(result.message).toBe("Folder not found");
	});

	it("should handle access denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await notesModule.getRecentNotesFromFolder("Claude", 5);

		expect(result.success).toBe(false);
		expect(result.message).toContain("Notes access is required");
	});

	it("should handle errors gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockRejectedValueOnce(new Error("unexpected error"));

		const result = await notesModule.getRecentNotesFromFolder("Claude");

		expect(result.success).toBe(false);
	});
});

// ─── getNotesByDateRange ───────────────────────────────────────────────────

describe("notes.getNotesByDateRange", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return success with notes", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes") // access check
			.mockResolvedValueOnce("SUCCESS:0"); // folder script

		const result = await notesModule.getNotesByDateRange(
			"Claude",
			"2026-01-01",
			"2026-12-31",
			10,
		);

		expect(result.success).toBe(true);
		expect(result.notes).toEqual([]);
	});

	it("should propagate failure from getNotesFromFolder", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockResolvedValueOnce("ERROR:Folder not found");

		const result = await notesModule.getNotesByDateRange("NonExistent");

		expect(result.success).toBe(false);
		expect(result.message).toBe("Folder not found");
	});

	it("should handle access denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await notesModule.getNotesByDateRange("Claude");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Notes access is required");
	});

	it("should handle errors gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Notes")
			.mockRejectedValueOnce(new Error("unexpected error"));

		const result = await notesModule.getNotesByDateRange("Claude");

		expect(result.success).toBe(false);
	});
});
