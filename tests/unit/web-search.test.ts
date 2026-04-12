import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock runAppleScript before importing the module
const mockRunAppleScript = mock(() => Promise.resolve(""));
mock.module("run-applescript", () => ({
	runAppleScript: mockRunAppleScript,
}));

// Import after mocking
const webSearchModule = (await import("../../utils/web-search.js")).default;

// ─── helpers ───────────────────────────────────────────────────────────────

/** Mock sequence for a happy-path search with a single result */
function mockHappyPathSingleResult(
	pageContent: string = "This is the page content",
) {
	mockRunAppleScript
		.mockResolvedValueOnce("") // openSafariWithTimeout (activate, new doc, bounds)
		.mockResolvedValueOnce("") // setUserAgent
		.mockResolvedValueOnce("") // navigateToUrl (Google search)
		.mockResolvedValueOnce(
			JSON.stringify([
				{ title: "Test Result", url: "https://example.com" },
			]),
		) // extractSearchResults
		.mockResolvedValueOnce("") // navigateToUrl (result page)
		.mockResolvedValueOnce(pageContent) // extractPageContent
		.mockResolvedValueOnce(""); // closeSafari
}

/** Mock sequence for a happy-path search with multiple results */
function mockHappyPathMultipleResults() {
	mockRunAppleScript
		.mockResolvedValueOnce("") // openSafariWithTimeout
		.mockResolvedValueOnce("") // setUserAgent
		.mockResolvedValueOnce("") // navigateToUrl (Google search)
		.mockResolvedValueOnce(
			JSON.stringify([
				{ title: "Result One", url: "https://one.example.com" },
				{ title: "Result Two", url: "https://two.example.com" },
			]),
		) // extractSearchResults
		.mockResolvedValueOnce("") // navigateToUrl (result 1)
		.mockResolvedValueOnce("Content from page one") // extractPageContent (result 1)
		.mockResolvedValueOnce("") // navigateToUrl (result 2)
		.mockResolvedValueOnce("Content from page two") // extractPageContent (result 2)
		.mockResolvedValueOnce(""); // closeSafari
}

// ─── performSearch ─────────────────────────────────────────────────────────

describe("webSearch.performSearch", () => {
	beforeEach(() => {
		mockRunAppleScript.mockReset();
	});

	// ── happy path ─────────────────────────────────────────────────────────

	it("should return search results and detailed content on success", async () => {
		mockHappyPathSingleResult();

		const result = await webSearchModule.performSearch("test query");

		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toContain("Test Result");
		expect(result.searchResults[0]).toContain("https://example.com");
		expect(result.detailedContent).toHaveLength(1);
		expect(result.detailedContent[0].url).toBe("https://example.com");
		expect(result.detailedContent[0].title).toBe("Test Result");
		expect(result.detailedContent[0].content).toBe(
			"This is the page content",
		);
	}, 15000);

	it("should format search results as title newline url", async () => {
		mockHappyPathSingleResult();

		const result = await webSearchModule.performSearch("test query");

		expect(result.searchResults[0]).toBe(
			"Test Result\nhttps://example.com",
		);
	}, 15000);

	it("should handle multiple search results", async () => {
		mockHappyPathMultipleResults();

		const result = await webSearchModule.performSearch("multi query", 2);

		expect(result.searchResults).toHaveLength(2);
		expect(result.searchResults[0]).toContain("Result One");
		expect(result.searchResults[1]).toContain("Result Two");
		expect(result.detailedContent).toHaveLength(2);
		expect(result.detailedContent[0].content).toBe("Content from page one");
		expect(result.detailedContent[1].content).toBe("Content from page two");
	}, 30000);

	it("should call closeSafari after successful search", async () => {
		mockHappyPathSingleResult();

		await webSearchModule.performSearch("test query");

		// The last call should be closeSafari
		const lastCall =
			mockRunAppleScript.mock.calls[
				mockRunAppleScript.mock.calls.length - 1
			];
		const lastScript = lastCall[0] as string;
		expect(lastScript).toContain("close document 1");
	}, 15000);

	// ── empty results ──────────────────────────────────────────────────────

	it("should return no-results message when search yields empty array", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("") // openSafariWithTimeout
			.mockResolvedValueOnce("") // setUserAgent
			.mockResolvedValueOnce("") // navigateToUrl (Google)
			.mockResolvedValueOnce("[]") // extractSearchResults (empty)
			.mockResolvedValueOnce(""); // closeSafari

		const result = await webSearchModule.performSearch("empty query");

		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toBe("No search results found.");
		expect(result.detailedContent).toHaveLength(0);
	}, 15000);

	it("should return no-results message when extractSearchResults returns invalid JSON", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("") // openSafariWithTimeout
			.mockResolvedValueOnce("") // setUserAgent
			.mockResolvedValueOnce("") // navigateToUrl (Google)
			.mockResolvedValueOnce("not valid json") // extractSearchResults (bad JSON)
			.mockResolvedValueOnce(""); // closeSafari

		const result = await webSearchModule.performSearch("bad json query");

		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toBe("No search results found.");
		expect(result.detailedContent).toHaveLength(0);
	}, 15000);

	// ── error handling ─────────────────────────────────────────────────────

	it("should return error message when openSafari fails", async () => {
		mockRunAppleScript
			.mockRejectedValueOnce(new Error("Safari not available")) // openSafariWithTimeout
			.mockResolvedValueOnce(""); // closeSafari (finally block)

		const result = await webSearchModule.performSearch("fail query");

		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toContain("Error performing search:");
		expect(result.searchResults[0]).toContain("Safari not available");
		expect(result.detailedContent).toHaveLength(0);
	});

	it("should return error message when setUserAgent fails", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("") // openSafariWithTimeout
			.mockRejectedValueOnce(new Error("user agent error")) // setUserAgent
			.mockResolvedValueOnce(""); // closeSafari (finally block)

		const result = await webSearchModule.performSearch("fail query");

		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toContain("Error performing search:");
		expect(result.searchResults[0]).toContain("user agent error");
		expect(result.detailedContent).toHaveLength(0);
	});

	it("should return error message when navigateToUrl fails for Google", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("") // openSafariWithTimeout
			.mockResolvedValueOnce("") // setUserAgent
			.mockRejectedValueOnce(new Error("navigation failed")) // navigateToUrl (Google)
			.mockResolvedValueOnce(""); // closeSafari (finally block)

		const result = await webSearchModule.performSearch("fail query");

		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toContain("Error performing search:");
		expect(result.searchResults[0]).toContain("navigation failed");
		expect(result.detailedContent).toHaveLength(0);
	});

	it("should call closeSafari even when an error occurs", async () => {
		mockRunAppleScript
			.mockRejectedValueOnce(new Error("early failure")) // openSafariWithTimeout
			.mockResolvedValueOnce(""); // closeSafari (finally block)

		await webSearchModule.performSearch("error query");

		// closeSafari should still be called in the finally block
		expect(mockRunAppleScript).toHaveBeenCalledTimes(2);
		const lastScript = mockRunAppleScript.mock.calls[1][0] as string;
		expect(lastScript).toContain("close document 1");
	});

	it("should handle non-Error thrown values", async () => {
		mockRunAppleScript
			.mockRejectedValueOnce("string error") // openSafariWithTimeout
			.mockResolvedValueOnce(""); // closeSafari

		const result = await webSearchModule.performSearch("fail query");

		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toContain("Error performing search:");
		expect(result.searchResults[0]).toContain("string error");
		expect(result.detailedContent).toHaveLength(0);
	});

	it("should handle closeSafari also throwing without breaking", async () => {
		mockRunAppleScript
			.mockRejectedValueOnce(new Error("main error")) // openSafariWithTimeout
			.mockRejectedValueOnce(new Error("close error")); // closeSafari (finally block)

		const result = await webSearchModule.performSearch("double fail");

		// Should still return the main error, not throw
		expect(result.searchResults).toHaveLength(1);
		expect(result.searchResults[0]).toContain("Error performing search:");
		expect(result.searchResults[0]).toContain("main error");
		expect(result.detailedContent).toHaveLength(0);
	});

	// ── scraping error for individual result ───────────────────────────────

	it("should include error content when scraping a result page fails", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("") // openSafariWithTimeout
			.mockResolvedValueOnce("") // setUserAgent
			.mockResolvedValueOnce("") // navigateToUrl (Google)
			.mockResolvedValueOnce(
				JSON.stringify([
					{ title: "Fail Page", url: "https://fail.example.com" },
				]),
			) // extractSearchResults
			.mockResolvedValueOnce("") // navigateToUrl (result page)
			.mockRejectedValueOnce(new Error("page content error")) // extractPageContent fails
			.mockResolvedValueOnce(""); // closeSafari

		const result = await webSearchModule.performSearch("scrape fail");

		expect(result.searchResults).toHaveLength(1);
		expect(result.detailedContent).toHaveLength(1);
		expect(result.detailedContent[0].content).toContain(
			"Error extracting content:",
		);
		expect(result.detailedContent[0].content).toContain(
			"page content error",
		);
	}, 15000);

	// ── cleanText behavior (tested via extractPageContent) ─────────────────

	it("should collapse multiple spaces into a single space", async () => {
		mockHappyPathSingleResult("word1    word2     word3");

		const result = await webSearchModule.performSearch("spaces query");

		expect(result.detailedContent[0].content).toBe("word1 word2 word3");
	}, 15000);

	it("should trim leading and trailing whitespace", async () => {
		mockHappyPathSingleResult("   trimmed content   ");

		const result = await webSearchModule.performSearch("trim query");

		expect(result.detailedContent[0].content).toBe("trimmed content");
	}, 15000);

	it("should limit content to 2000 characters", async () => {
		const longContent = "A".repeat(3000);
		mockHappyPathSingleResult(longContent);

		const result = await webSearchModule.performSearch("long query");

		expect(result.detailedContent[0].content.length).toBeLessThanOrEqual(
			2000,
		);
	}, 15000);

	it("should return empty string for falsy page content", async () => {
		mockHappyPathSingleResult("");

		const result = await webSearchModule.performSearch("empty content");

		expect(result.detailedContent[0].content).toBe("");
	}, 15000);

	// ── URL encoding ───────────────────────────────────────────────────────

	it("should encode the search query in the Google URL", async () => {
		mockHappyPathSingleResult();

		await webSearchModule.performSearch("hello world");

		// The 3rd call is navigateToUrl for Google search
		const googleNavScript = mockRunAppleScript.mock.calls[2][0] as string;
		expect(googleNavScript).toContain("hello%20world");
	}, 15000);

	it("should encode special characters in the search query", async () => {
		mockHappyPathSingleResult();

		await webSearchModule.performSearch("test & query");

		const googleNavScript = mockRunAppleScript.mock.calls[2][0] as string;
		expect(googleNavScript).toContain("test%20%26%20query");
	}, 15000);

	// ── default numResults ─────────────────────────────────────────────────

	it("should use default of 3 for numResults when not specified", async () => {
		mockRunAppleScript
			.mockResolvedValueOnce("") // openSafariWithTimeout
			.mockResolvedValueOnce("") // setUserAgent
			.mockResolvedValueOnce("") // navigateToUrl (Google)
			.mockResolvedValueOnce(
				JSON.stringify([
					{ title: "R1", url: "https://r1.example.com" },
					{ title: "R2", url: "https://r2.example.com" },
					{ title: "R3", url: "https://r3.example.com" },
				]),
			) // extractSearchResults
			.mockResolvedValueOnce("") // navigateToUrl (r1)
			.mockResolvedValueOnce("Content 1") // extractPageContent (r1)
			.mockResolvedValueOnce("") // navigateToUrl (r2)
			.mockResolvedValueOnce("Content 2") // extractPageContent (r2)
			.mockResolvedValueOnce("") // navigateToUrl (r3)
			.mockResolvedValueOnce("Content 3") // extractPageContent (r3)
			.mockResolvedValueOnce(""); // closeSafari

		const result = await webSearchModule.performSearch("default count");

		expect(result.searchResults).toHaveLength(3);
		expect(result.detailedContent).toHaveLength(3);
	}, 30000);
});
