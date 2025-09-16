// /packages/demo_services/ui_demo/service_integration_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { CallbackEvent, CommandEvent, ServiceResponse } from "@sdk/mod.ts";
import service from "./service.ts";

const mockContext = {
	chatId: "test-chat",
	userId: "test-user",
	language: "en" as const,
	serviceConfig: {},
};

Deno.test("UI Demo Service - Complete Carousel Navigation Flow", function () {
	// Step 1: Start with command
	const commandEvent: CommandEvent = {
		type: "command",
		...mockContext,
	};

	const initialResponse = service.handlers.command(commandEvent) as ServiceResponse;
	assertEquals(initialResponse.kind, "ui");

	// Step 2: Click carousel demo
	const carouselDemoEvent: CallbackEvent = {
		type: "callback",
		data: "demo_carousel",
		...mockContext,
		state: {},
	};

	const carouselResponse = service.handlers.callback(carouselDemoEvent) as ServiceResponse;
	assertEquals(carouselResponse.kind, "ui");
	if (carouselResponse.kind === "ui") {
		assertEquals(carouselResponse.uiType, "carousel");
		// Should show first card by default
		const carousel = carouselResponse.ui as import("@sdk/mod.ts").UICarousel;
		assertEquals(carousel.items.length, 1); // Only current item shown
	}

	// Step 3: Navigate to next item
	const nextEvent: CallbackEvent = {
		type: "callback",
		data: "carousel_next",
		...mockContext,
		state: { carouselIndex: 0 },
	};

	const nextResponse = service.handlers.callback(nextEvent) as ServiceResponse;
	assertEquals(nextResponse.kind, "ui");
	if (nextResponse.kind === "ui") {
		assertEquals(nextResponse.uiType, "carousel");
		assertEquals(nextResponse.state?.op, "replace");
		if (nextResponse.state?.op === "replace") {
			const stateValue = nextResponse.state.value as Record<string, unknown>;
			assertEquals(stateValue.carouselIndex, 1);
		}
	}

	// Step 4: Navigate to previous item
	const prevEvent: CallbackEvent = {
		type: "callback",
		data: "carousel_prev",
		...mockContext,
		state: { carouselIndex: 1 },
	};

	const prevResponse = service.handlers.callback(prevEvent) as ServiceResponse;
	assertEquals(prevResponse.kind, "ui");
	if (prevResponse.kind === "ui") {
		assertEquals(prevResponse.uiType, "carousel");
		assertEquals(prevResponse.state?.op, "replace");
		if (prevResponse.state?.op === "replace") {
			const stateValue = prevResponse.state.value as Record<string, unknown>;
			assertEquals(stateValue.carouselIndex, 0);
		}
	}

	// Step 5: Go back to main menu
	const backEvent: CallbackEvent = {
		type: "callback",
		data: "back_to_main",
		...mockContext,
		state: { carouselIndex: 0 },
	};

	const backResponse = service.handlers.callback(backEvent) as ServiceResponse;
	assertEquals(backResponse.kind, "ui");
	if (backResponse.kind === "ui") {
		assertEquals(backResponse.uiType, "keyboard"); // Back to main menu
	}
});

Deno.test("UI Demo Service - Edge Cases and Boundary Conditions", function () {
	// Test carousel navigation at boundaries
	const atEndEvent: CallbackEvent = {
		type: "callback",
		data: "carousel_next",
		...mockContext,
		state: { carouselIndex: 2 }, // At last item
	};

	const atEndResponse = service.handlers.callback(atEndEvent) as ServiceResponse;
	assertEquals(atEndResponse.kind, "ui");
	if (atEndResponse.kind === "ui" && atEndResponse.state?.op === "replace") {
		const stateValue = atEndResponse.state.value as Record<string, unknown>;
		assertEquals(stateValue.carouselIndex, 2); // Should not go beyond last item
	}

	// Test carousel navigation at beginning
	const atStartEvent: CallbackEvent = {
		type: "callback",
		data: "carousel_prev",
		...mockContext,
		state: { carouselIndex: 0 }, // At first item
	};

	const atStartResponse = service.handlers.callback(atStartEvent) as ServiceResponse;
	assertEquals(atStartResponse.kind, "ui");
	if (atStartResponse.kind === "ui" && atStartResponse.state?.op === "replace") {
		const stateValue = atStartResponse.state.value as Record<string, unknown>;
		assertEquals(stateValue.carouselIndex, 0); // Should not go below first item
	}

	// Test unknown callback
	const unknownEvent: CallbackEvent = {
		type: "callback",
		data: "unknown_action",
		...mockContext,
	};

	const unknownResponse = service.handlers.callback(unknownEvent) as ServiceResponse;
	assertEquals(unknownResponse.kind, "reply");
	if (unknownResponse.kind === "reply") {
		assertEquals(unknownResponse.text, "Please select an option");
	}
});
