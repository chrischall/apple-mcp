import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Import after mocking
const contactsModule = (await import("../../utils/contacts.js")).default;

// ─── requestContactsAccess ─────────────────────────────────────────────────

describe("contacts.requestContactsAccess", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return hasAccess true when Contacts app responds", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Contacts");

		const result = await contactsModule.requestContactsAccess();

		expect(result.hasAccess).toBe(true);
		expect(result.message).toContain("already granted");
	});

	it("should return hasAccess false when Contacts app throws", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await contactsModule.requestContactsAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Contacts access is required");
	});

	it("should include setup instructions when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("not authorized"));

		const result = await contactsModule.requestContactsAccess();

		expect(result.message).toContain("System Settings");
		expect(result.message).toContain("Privacy & Security");
		expect(result.message).toContain("Automation");
	});
});

// ─── getAllNumbers ──────────────────────────────────────────────────────────

describe("contacts.getAllNumbers", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return contacts dict from array result", async () => {
		const mockContacts = [
			{ name: "Alice Smith", phones: ["+1234567890", "+0987654321"] },
			{ name: "Bob Jones", phones: ["+1112223333"] },
		];

		mockRunAppleScript
			.mockResolvedValueOnce("Contacts") // access check
			.mockResolvedValueOnce(mockContacts); // getAllNumbers script

		const result = await contactsModule.getAllNumbers();

		expect(result["Alice Smith"]).toEqual(["+1234567890", "+0987654321"]);
		expect(result["Bob Jones"]).toEqual(["+1112223333"]);
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
	});

	it("should wrap single phone string into array", async () => {
		const mockContacts = [
			{ name: "Charlie", phones: "+5551234567" },
		];

		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce(mockContacts);

		const result = await contactsModule.getAllNumbers();

		expect(result["Charlie"]).toEqual(["+5551234567"]);
	});

	it("should handle non-array result gracefully", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce("unexpected string");

		const result = await contactsModule.getAllNumbers();

		expect(typeof result).toBe("object");
		// A non-array string without name/phones properties yields empty dict
		expect(Object.keys(result)).toHaveLength(0);
	});

	it("should return empty dict when result is null", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce(null);

		const result = await contactsModule.getAllNumbers();

		expect(result).toEqual({});
	});

	it("should return empty dict when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await contactsModule.getAllNumbers();

		expect(result).toEqual({});
	});

	it("should return empty dict when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await contactsModule.getAllNumbers();

		expect(result).toEqual({});
	});

	it("should skip contacts missing name or phones", async () => {
		const mockContacts = [
			{ name: "Valid", phones: ["+111"] },
			{ name: null, phones: ["+222"] },
			{ phones: ["+333"] },
			{ name: "NoPhones" },
			{ name: "AlsoValid", phones: ["+444"] },
		];

		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce(mockContacts);

		const result = await contactsModule.getAllNumbers();

		expect(Object.keys(result)).toEqual(["Valid", "AlsoValid"]);
	});
});

// ─── findNumber ────────────────────────────────────────────────────────────

describe("contacts.findNumber", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return phone numbers from AppleScript result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts") // access check
			.mockResolvedValueOnce(["+1234567890", "+0987654321"]); // findNumber script

		const result = await contactsModule.findNumber("Alice");

		expect(result).toEqual(["+1234567890", "+0987654321"]);
	});

	it("should return empty array for empty name", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Contacts");

		const result = await contactsModule.findNumber("");

		expect(result).toEqual([]);
	});

	it("should return empty array for whitespace-only name", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Contacts");

		const result = await contactsModule.findNumber("   ");

		expect(result).toEqual([]);
	});

	it("should fall back to getAllNumbers fuzzy search when AppleScript returns empty", async () => {
		const mockContacts = [
			{ name: "Alice Smith", phones: ["+1234567890"] },
		];

		mockRunAppleScript
			.mockResolvedValueOnce("Contacts") // access check for findNumber
			.mockResolvedValueOnce([]) // findNumber script returns empty
			.mockResolvedValueOnce("Contacts") // access check for getAllNumbers fallback
			.mockResolvedValueOnce(mockContacts); // getAllNumbers script

		const result = await contactsModule.findNumber("alice");

		expect(result).toEqual(["+1234567890"]);
	});

	it("should handle non-array AppleScript result", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce("+5551234567"); // single string instead of array

		const result = await contactsModule.findNumber("Bob");

		expect(result).toEqual(["+5551234567"]);
	});

	it("should return empty array when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await contactsModule.findNumber("Alice");

		expect(result).toEqual([]);
	});

	it("should filter out empty strings from results", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce(["+1234567890", "", "  ", "+0987654321"]);

		const result = await contactsModule.findNumber("Alice");

		expect(result).toEqual(["+1234567890", "+0987654321"]);
	});

	it("should handle AppleScript error and try fallback", async () => {
		const mockContacts = [
			{ name: "Alice Smith", phones: ["+1234567890"] },
		];

		mockRunAppleScript
			.mockResolvedValueOnce("Contacts") // access check for findNumber
			.mockRejectedValueOnce(new Error("script error")) // findNumber script fails
			.mockResolvedValueOnce("Contacts") // access check for getAllNumbers fallback
			.mockResolvedValueOnce(mockContacts); // getAllNumbers script

		const result = await contactsModule.findNumber("alice");

		expect(result).toEqual(["+1234567890"]);
	});
});

// ─── findContactByPhone ────────────────────────────────────────────────────

describe("contacts.findContactByPhone", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	it("should return contact name when found by AppleScript", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts") // access check
			.mockResolvedValueOnce("Alice Smith"); // findContactByPhone script

		const result = await contactsModule.findContactByPhone("+1234567890");

		expect(result).toBe("Alice Smith");
	});

	it("should return null for empty phone number", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Contacts");

		const result = await contactsModule.findContactByPhone("");

		expect(result).toBeNull();
	});

	it("should return null for whitespace-only phone number", async () => {
		mockRunAppleScript.mockResolvedValueOnce("Contacts");

		const result = await contactsModule.findContactByPhone("   ");

		expect(result).toBeNull();
	});

	it("should normalize phone number by stripping non-digit chars except +", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce("Bob Jones");

		await contactsModule.findContactByPhone("(123) 456-7890");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("1234567890");
		expect(script).not.toContain("(123)");
	});

	it("should preserve + prefix during normalization", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockResolvedValueOnce("Bob Jones");

		await contactsModule.findContactByPhone("+1 (234) 567-8901");

		const script = mockRunAppleScript.mock.calls[1][0] as string;
		expect(script).toContain("+12345678901");
	});

	it("should fall back to getAllNumbers when AppleScript returns empty", async () => {
		const mockContacts = [
			{ name: "Alice Smith", phones: ["+1234567890"] },
		];

		mockRunAppleScript
			.mockResolvedValueOnce("Contacts") // access check for findContactByPhone
			.mockResolvedValueOnce("") // findContactByPhone script returns empty
			.mockResolvedValueOnce("Contacts") // access check for getAllNumbers fallback
			.mockResolvedValueOnce(mockContacts); // getAllNumbers script

		const result = await contactsModule.findContactByPhone("+1234567890");

		expect(result).toBe("Alice Smith");
	});

	it("should return null when no match found anywhere", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts") // access check
			.mockResolvedValueOnce("") // findContactByPhone script returns empty
			.mockResolvedValueOnce("Contacts") // access check for getAllNumbers
			.mockResolvedValueOnce([]); // getAllNumbers returns empty

		const result = await contactsModule.findContactByPhone("+9999999999");

		expect(result).toBeNull();
	});

	it("should return null when access is denied", async () => {
		mockRunAppleScript.mockRejectedValueOnce(new Error("access denied"));

		const result = await contactsModule.findContactByPhone("+1234567890");

		expect(result).toBeNull();
	});

	it("should return null when AppleScript throws", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("Contacts")
			.mockRejectedValueOnce(new Error("script error"));

		const result = await contactsModule.findContactByPhone("+1234567890");

		expect(result).toBeNull();
	});
});
