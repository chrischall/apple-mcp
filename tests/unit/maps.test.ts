import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock @jxa/run before importing the module
const mockRun = mock(() => Promise.resolve(true));
mock.module("@jxa/run", () => ({
	run: mockRun,
}));

// Import after mocking
const mapsModule = (await import("../../utils/maps.js")).default;

// ─── requestMapsAccess ─────────────────────────────────────────────────────

describe("maps.requestMapsAccess", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return hasAccess true when run succeeds", async () => {
		mockRun.mockResolvedValueOnce(true);

		const result = await mapsModule.requestMapsAccess();

		expect(result.hasAccess).toBe(true);
		expect(result.message).toContain("already granted");
	});

	it("should return hasAccess false with instructions when run throws", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.requestMapsAccess();

		expect(result.hasAccess).toBe(false);
		expect(result.message).toContain("Maps access is required");
		expect(result.message).toContain("System Settings");
		expect(result.message).toContain("Privacy & Security");
		expect(result.message).toContain("Automation");
	});
});

// ─── searchLocations ───────────────────────────────────────────────────────

describe("maps.searchLocations", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return locations on success", async () => {
		const mockLocations = [
			{
				id: "loc-1",
				name: "Apple Park",
				address: "One Apple Park Way",
				latitude: 37.3349,
				longitude: -122.0090,
				category: "Technology",
				isFavorite: false,
			},
		];

		mockRun
			.mockResolvedValueOnce(true) // access check
			.mockResolvedValueOnce(mockLocations); // search result

		const result = await mapsModule.searchLocations("Apple Park");

		expect(result.success).toBe(true);
		expect(result.locations).toHaveLength(1);
		expect(result.locations[0].name).toBe("Apple Park");
		expect(mockRun).toHaveBeenCalledTimes(2);
	});

	it("should return success with empty locations array", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce([]);

		const result = await mapsModule.searchLocations("nonexistent place xyz");

		expect(result.success).toBe(true);
		expect(result.locations).toHaveLength(0);
	});

	it("should return failure when access is denied", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.searchLocations("test query");

		expect(result.success).toBe(false);
		expect(result.locations).toHaveLength(0);
		expect(result.message).toContain("Maps access is required");
	});

	it("should handle run error during search", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error("search failed"));

		const result = await mapsModule.searchLocations("test");

		expect(result.success).toBe(false);
		expect(result.locations).toHaveLength(0);
		expect(result.message).toContain("search failed");
	});
});

// ─── saveLocation ──────────────────────────────────────────────────────────

describe("maps.saveLocation", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return result from run on success", async () => {
		const mockResult = {
			success: true,
			message: 'Added "Home" to favorites',
			location: {
				id: "loc-1",
				name: "Home",
				address: "123 Main St",
				latitude: 37.0,
				longitude: -122.0,
				category: null,
				isFavorite: true,
			},
		};

		mockRun
			.mockResolvedValueOnce(true) // access check
			.mockResolvedValueOnce(mockResult); // save result

		const result = await mapsModule.saveLocation("Home", "123 Main St");

		expect(result.success).toBe(true);
		expect(result.message).toContain("Home");
		expect(mockRun).toHaveBeenCalledTimes(2);
	});

	it("should return failure for empty name", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.saveLocation("  ", "123 Main St");

		expect(result.success).toBe(false);
		expect(result.message).toContain("name cannot be empty");
	});

	it("should return failure for empty address", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.saveLocation("Home", "  ");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Address cannot be empty");
	});

	it("should return failure when access is denied", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.saveLocation("Home", "123 Main St");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Maps access is required");
	});

	it("should handle run error during save", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error("save failed"));

		const result = await mapsModule.saveLocation("Home", "123 Main St");

		expect(result.success).toBe(false);
		expect(result.message).toContain("save failed");
	});
});

// ─── getDirections ─────────────────────────────────────────────────────────

describe("maps.getDirections", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return directions on success", async () => {
		const mockResult = {
			success: true,
			message: 'Displaying directions from "A" to "B" by driving',
			route: {
				distance: "See Maps app for details",
				duration: "See Maps app for details",
				startAddress: "San Francisco",
				endAddress: "Los Angeles",
			},
		};

		mockRun
			.mockResolvedValueOnce(true) // access check
			.mockResolvedValueOnce(mockResult); // directions result

		const result = await mapsModule.getDirections("San Francisco", "Los Angeles");

		expect(result.success).toBe(true);
		expect(result.route).toBeDefined();
		expect(result.route!.startAddress).toBe("San Francisco");
		expect(result.route!.endAddress).toBe("Los Angeles");
	});

	it("should return failure for empty from address", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.getDirections("  ", "Los Angeles");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Both from and to addresses are required");
	});

	it("should return failure for empty to address", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.getDirections("San Francisco", "  ");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Both from and to addresses are required");
	});

	it("should return failure for invalid transport type", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.getDirections(
			"San Francisco",
			"Los Angeles",
			"flying" as any,
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("Invalid transport type");
		expect(result.message).toContain("flying");
	});

	it("should accept valid transport types", async () => {
		for (const transport of ["driving", "walking", "transit"] as const) {
			mockRun.mockReset();
			mockRun
				.mockResolvedValueOnce(true)
				.mockResolvedValueOnce({
					success: true,
					message: `Directions by ${transport}`,
					route: {
						distance: "10 mi",
						duration: "20 min",
						startAddress: "A",
						endAddress: "B",
					},
				});

			const result = await mapsModule.getDirections("A", "B", transport);
			expect(result.success).toBe(true);
		}
	});

	it("should return failure when access is denied", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.getDirections("San Francisco", "Los Angeles");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Maps access is required");
	});

	it("should handle run error during directions", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error("directions failed"));

		const result = await mapsModule.getDirections("A", "B");

		expect(result.success).toBe(false);
		expect(result.message).toContain("directions failed");
	});
});

// ─── dropPin ───────────────────────────────────────────────────────────────

describe("maps.dropPin", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return result from run on success", async () => {
		const mockResult = {
			success: true,
			message: 'Showing "123 Main St" in Maps.',
		};

		mockRun
			.mockResolvedValueOnce(true) // access check
			.mockResolvedValueOnce(mockResult); // drop pin result

		const result = await mapsModule.dropPin("Home", "123 Main St");

		expect(result.success).toBe(true);
		expect(result.message).toContain("123 Main St");
		expect(mockRun).toHaveBeenCalledTimes(2);
	});

	it("should return failure when access is denied", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.dropPin("Home", "123 Main St");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Maps access is required");
	});

	it("should handle run error during drop pin", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error("pin error"));

		const result = await mapsModule.dropPin("Home", "123 Main St");

		expect(result.success).toBe(false);
		expect(result.message).toContain("pin error");
	});
});

// ─── listGuides ────────────────────────────────────────────────────────────

describe("maps.listGuides", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return result from run on success", async () => {
		const mockResult = {
			success: true,
			message: "Opened guides view in Maps",
			guides: [],
		};

		mockRun
			.mockResolvedValueOnce(true) // access check
			.mockResolvedValueOnce(mockResult); // list guides result

		const result = await mapsModule.listGuides();

		expect(result.success).toBe(true);
		expect(result.message).toContain("guides");
		expect(mockRun).toHaveBeenCalledTimes(2);
	});

	it("should return failure when access is denied", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.listGuides();

		expect(result.success).toBe(false);
		expect(result.message).toContain("Maps access is required");
	});

	it("should handle run error during list guides", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error("guides error"));

		const result = await mapsModule.listGuides();

		expect(result.success).toBe(false);
		expect(result.message).toContain("guides error");
	});
});

// ─── addToGuide ────────────────────────────────────────────────────────────

describe("maps.addToGuide", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return result from run on success", async () => {
		const mockResult = {
			success: true,
			message: 'Showing "123 Main St" in Maps. Add to "My Guide" guide.',
			guideName: "My Guide",
			locationName: "123 Main St",
		};

		mockRun
			.mockResolvedValueOnce(true) // access check
			.mockResolvedValueOnce(mockResult); // add to guide result

		const result = await mapsModule.addToGuide("123 Main St", "My Guide");

		expect(result.success).toBe(true);
		expect(result.guideName).toBe("My Guide");
		expect(mockRun).toHaveBeenCalledTimes(2);
	});

	it("should return failure for empty address", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.addToGuide("  ", "My Guide");

		expect(result.success).toBe(false);
		expect(result.message).toContain("address cannot be empty");
	});

	it("should return failure for empty guide name", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.addToGuide("123 Main St", "  ");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Guide name cannot be empty");
	});

	it("should return failure for guide name containing NonExistent", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.addToGuide("123 Main St", "NonExistent Guide");

		expect(result.success).toBe(false);
		expect(result.message).toContain("does not exist");
	});

	it("should return failure for guide name containing 12345", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.addToGuide("123 Main St", "Guide 12345");

		expect(result.success).toBe(false);
		expect(result.message).toContain("does not exist");
	});

	it("should return failure when access is denied", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.addToGuide("123 Main St", "My Guide");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Maps access is required");
	});

	it("should handle run error during add to guide", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error("guide error"));

		const result = await mapsModule.addToGuide("123 Main St", "My Guide");

		expect(result.success).toBe(false);
		expect(result.message).toContain("guide error");
	});
});

// ─── createGuide ───────────────────────────────────────────────────────────

describe("maps.createGuide", () => {
	beforeEach(() => {
		mockRun.mockReset();
	});

	it("should return result from run on success", async () => {
		const mockResult = {
			success: true,
			message: 'Opened guides view to create new guide "Travel".',
			guideName: "Travel",
		};

		mockRun
			.mockResolvedValueOnce(true) // access check
			.mockResolvedValueOnce(mockResult); // create guide result

		const result = await mapsModule.createGuide("Travel");

		expect(result.success).toBe(true);
		expect(result.guideName).toBe("Travel");
		expect(mockRun).toHaveBeenCalledTimes(2);
	});

	it("should return failure for empty name", async () => {
		mockRun.mockResolvedValueOnce(true); // access check

		const result = await mapsModule.createGuide("  ");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Guide name cannot be empty");
	});

	it("should return failure when access is denied", async () => {
		mockRun.mockRejectedValueOnce(new Error("Cannot access Maps app"));

		const result = await mapsModule.createGuide("Travel");

		expect(result.success).toBe(false);
		expect(result.message).toContain("Maps access is required");
	});

	it("should handle run error during create guide", async () => {
		mockRun
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error("create error"));

		const result = await mapsModule.createGuide("Travel");

		expect(result.success).toBe(false);
		expect(result.message).toContain("create error");
	});
});
