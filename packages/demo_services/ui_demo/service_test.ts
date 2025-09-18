// /packages/demo_services/ui_demo/service_test.ts
import service from "./service.ts";
import { assertEquals } from "jsr:@std/assert@1";
import type { CallbackEvent, CommandEvent, ServiceResponse } from "@sdk/mod.ts";

const mockContext = {
	chatId: "test-chat",
	userId: "test-user",
	language: "en" as const,
	serviceConfig: {},
};

Deno.test("UI Demo Service - Command Handler", function () {
	const event: CommandEvent = {
		type: "command",
		...mockContext,
	};

	const response = service.handlers.command(event) as ServiceResponse;

	assertEquals(response.kind, "ui");
	if (response.kind === "ui") {
		assertEquals(response.uiType, "keyboard");
	}
});

Deno.test("UI Demo Service - Keyboard Demo Callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "demo_keyboard",
		...mockContext,
		routeMeta: { id: "ui_demo", command: "ui" },
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "ui");
	if (response.kind === "ui") {
		assertEquals(response.uiType, "keyboard");
	}
});

Deno.test("UI Demo Service - Carousel Demo Callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "demo_carousel",
		...mockContext,
		state: {},
		routeMeta: { id: "ui_demo", command: "ui" },
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "ui");
	if (response.kind === "ui") {
		assertEquals(response.uiType, "carousel");
	}
});

Deno.test("UI Demo Service - Carousel Navigation Next", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "carousel_next",
		...mockContext,
		state: { carouselIndex: 0 },
		routeMeta: { id: "ui_demo", command: "ui" },
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "ui");
	if (response.kind === "ui") {
		assertEquals(response.uiType, "carousel");
		assertEquals(response.state?.op, "replace");
		if (response.state?.op === "replace") {
			const stateValue = response.state.value as Record<string, unknown>;
			assertEquals(stateValue.carouselIndex, 1);
		}
	}
});

Deno.test("UI Demo Service - Carousel Navigation Previous", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "carousel_prev",
		...mockContext,
		state: { carouselIndex: 1 },
		routeMeta: { id: "ui_demo", command: "ui" },
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "ui");
	if (response.kind === "ui") {
		assertEquals(response.uiType, "carousel");
		assertEquals(response.state?.op, "replace");
		if (response.state?.op === "replace") {
			const stateValue = response.state.value as Record<string, unknown>;
			assertEquals(stateValue.carouselIndex, 0);
		}
	}
});
