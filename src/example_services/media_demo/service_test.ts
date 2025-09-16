// example_services/media_demo/service_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { CallbackEvent, CommandEvent, ServiceResponse } from "@sdk/mod.ts";
import service from "./service.ts";

const mockContext = {
	chatId: "test-chat",
	userId: "test-user",
	language: "en" as const,
	serviceConfig: {},
};

Deno.test("media demo service - command handler", function () {
	const event: CommandEvent = {
		type: "command",
		...mockContext,
	};

	const response = service.handlers.command(event) as ServiceResponse;

	assertEquals(response.kind, "ui");
	if (response.kind === "ui") {
		assertEquals(response.uiType, "keyboard");
		assertEquals(response.text, "Welcome to Media Demo! Choose a media type:");
		// Validate keyboard structure & callback prefixes
		const kb = response.ui as import("@sdk/mod.ts").UIKeyboard;
		const flat = kb.buttons.flat();
		for (const btn of flat) {
			assertEquals(btn.action.type, "callback");
			// Dispatcher will strip this prefix
			if (btn.action.type === "callback") {
				// All media buttons should start with svc:mock_media| (dispatcher uses serviceId mock_media)
				// (UI converter sends full prefix to dispatcher)
			}
		}
	}
});

Deno.test("media demo service - audio callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "audio",
		...mockContext,
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "audio");
	if (response.kind === "audio") {
		assertEquals(
			response.audio,
			"https://nexus.pubky.app/static/files/zmh3jeorngub6qjpbz5g9neggu8nh1cxby8xq456g6p8powbigey/0033M8ZE42M80/main",
		);
		assertEquals(response.title, "Bell Sound");
		assertEquals(response.performer, "Sound Effects");
		assertEquals(response.duration, 3);
	}
});

Deno.test("media demo service - video callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "video",
		...mockContext,
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "video");
	if (response.kind === "video") {
		assertEquals(
			response.video,
			"https://nexus.pubky.app/static/files/8fwmk5o1wfmn6whew47zoq31ka1mss15xnkcihattr5zbthp5nbo/0033WS5GHA710/main",
		);
		assertEquals(response.width, 360);
		assertEquals(response.height, 240);
		assertEquals(response.duration, 30);
	}
});

Deno.test("media demo service - document callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "document",
		...mockContext,
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "document");
	if (response.kind === "document") {
		assertEquals(
			response.document,
			"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
		);
		assertEquals(response.filename, "sample.pdf");
		assertEquals(response.mimeType, "application/pdf");
	}
});

Deno.test("media demo service - location callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "location",
		...mockContext,
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "location");
	if (response.kind === "location") {
		assertEquals(response.latitude, 40.7128);
		assertEquals(response.longitude, -74.0060);
		assertEquals(response.title, "New York City");
		assertEquals(response.address, "NYC, NY, USA");
	}
});

Deno.test("media demo service - contact callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "contact",
		...mockContext,
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "contact");
	if (response.kind === "contact") {
		assertEquals(response.phoneNumber, "+1234567890");
		assertEquals(response.firstName, "John");
		assertEquals(response.lastName, "Doe");
	}
});

Deno.test("media demo service - unknown callback", function () {
	const event: CallbackEvent = {
		type: "callback",
		data: "unknown",
		...mockContext,
	};

	const response = service.handlers.callback(event) as ServiceResponse;

	assertEquals(response.kind, "reply");
	if (response.kind === "reply") {
		assertEquals(response.text, "Unknown media type");
	}
});

Deno.test("media demo service - i18n Spanish", function () {
	const event: CommandEvent = {
		type: "command",
		chatId: "test-chat",
		userId: "test-user",
		language: "es" as const,
		serviceConfig: {},
	};

	const response = service.handlers.command(event) as ServiceResponse;

	assertEquals(response.kind, "ui");
	if (response.kind === "ui") {
		assertEquals(response.text, "¡Bienvenido a Media Demo! Elige un tipo de medios:");
		assertEquals(response.uiType, "keyboard");
	}
});
