// /packages/demo_services/media_demo/service_integration_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import type { CallbackEvent, CommandEvent, ServiceResponse } from "@sdk/mod.ts";
import service from "./service.ts";

const mockContext = {
	chatId: "test-chat",
	userId: "test-user",
	language: "en" as const,
	serviceConfig: {},
};

Deno.test("Media Demo Service - Complete Media Flow", function () {
	// Step 1: Start with command
	const commandEvent: CommandEvent = {
		type: "command",
		...mockContext,
	};

	const initialResponse = service.handlers.command(commandEvent) as ServiceResponse;
	assertEquals(initialResponse.kind, "ui");
	if (initialResponse.kind === "ui") {
		assertEquals(initialResponse.uiType, "keyboard");
		assertEquals(initialResponse.text, "Welcome to Media Demo! Choose a media type:");
		const kb = initialResponse.ui as import("@sdk/mod.ts").UIKeyboard;
		// Ensure we have expected number of rows (each button on its own row)
		assertEquals(kb.buttons.length, 6);
	}

	// Step 2: Test audio callback with full service prefix
	const audioEvent: CallbackEvent = {
		type: "callback",
		data: "audio",
		...mockContext,
	};

	const audioResponse = service.handlers.callback(audioEvent) as ServiceResponse;
	assertEquals(audioResponse.kind, "audio");
	if (audioResponse.kind === "audio") {
		assertEquals(
			audioResponse.audio,
			"https://nexus.pubky.app/static/files/zmh3jeorngub6qjpbz5g9neggu8nh1cxby8xq456g6p8powbigey/0033M8ZE42M80/main",
		);
		assertEquals(audioResponse.title, "Bell Sound");
		assertEquals(audioResponse.performer, "Sound Effects");
		assertEquals(audioResponse.duration, 3);
	}

	// Step 3: Test video callback
	const videoEvent: CallbackEvent = {
		type: "callback",
		data: "video",
		...mockContext,
	};

	const videoResponse = service.handlers.callback(videoEvent) as ServiceResponse;
	assertEquals(videoResponse.kind, "video");
	if (videoResponse.kind === "video") {
		assertEquals(
			videoResponse.video,
			"https://nexus.pubky.app/static/files/8fwmk5o1wfmn6whew47zoq31ka1mss15xnkcihattr5zbthp5nbo/0033WS5GHA710/main",
		);
		assertEquals(videoResponse.width, 360);
		assertEquals(videoResponse.height, 240);
		assertEquals(videoResponse.duration, 30);
	}

	// Step 4: Test document callback
	const documentEvent: CallbackEvent = {
		type: "callback",
		data: "document",
		...mockContext,
	};

	const documentResponse = service.handlers.callback(documentEvent) as ServiceResponse;
	assertEquals(documentResponse.kind, "document");
	if (documentResponse.kind === "document") {
		assertEquals(
			documentResponse.document,
			"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
		);
		assertEquals(documentResponse.filename, "sample.pdf");
		assertEquals(documentResponse.mimeType, "application/pdf");
	}

	// Step 5: Test location callback
	const locationEvent: CallbackEvent = {
		type: "callback",
		data: "location",
		...mockContext,
	};

	const locationResponse = service.handlers.callback(locationEvent) as ServiceResponse;
	assertEquals(locationResponse.kind, "location");
	if (locationResponse.kind === "location") {
		assertEquals(locationResponse.latitude, 40.7128);
		assertEquals(locationResponse.longitude, -74.0060);
		assertEquals(locationResponse.title, "New York City");
		assertEquals(locationResponse.address, "NYC, NY, USA");
	}

	// Step 6: Test contact callback
	const contactEvent: CallbackEvent = {
		type: "callback",
		data: "contact",
		...mockContext,
	};

	const contactResponse = service.handlers.callback(contactEvent) as ServiceResponse;
	assertEquals(contactResponse.kind, "contact");
	if (contactResponse.kind === "contact") {
		assertEquals(contactResponse.phoneNumber, "+1234567890");
		assertEquals(contactResponse.firstName, "John");
		assertEquals(contactResponse.lastName, "Doe");
	}
});

Deno.test("Media Demo Service - Error Handling", function () {
	// Test unknown media type
	const unknownEvent: CallbackEvent = {
		type: "callback",
		data: "unknown",
		...mockContext,
	};

	const unknownResponse = service.handlers.callback(unknownEvent) as ServiceResponse;
	assertEquals(unknownResponse.kind, "reply");
	if (unknownResponse.kind === "reply") {
		assertEquals(unknownResponse.text, "Unknown media type");
	}

	// Test malformed callback data
	const malformedEvent: CallbackEvent = {
		type: "callback",
		data: "not_a_service_callback",
		...mockContext,
	};

	const malformedResponse = service.handlers.callback(malformedEvent) as ServiceResponse;
	assertEquals(malformedResponse.kind, "reply");
	if (malformedResponse.kind === "reply") {
		assertEquals(malformedResponse.text, "Unknown media type");
	}
});

Deno.test("Media Demo Service - Service Callback Parsing", function () {
	// Test that service correctly parses callback data format
	const callbackFormats = [
		{ data: "audio", expectedType: "audio" },
		{ data: "video", expectedType: "video" },
		{ data: "document", expectedType: "document" },
		{ data: "location", expectedType: "location" },
		{ data: "contact", expectedType: "contact" },
	];

	for (const { data, expectedType } of callbackFormats) {
		const event: CallbackEvent = {
			type: "callback",
			data,
			...mockContext,
		};

		const response = service.handlers.callback(event) as ServiceResponse;
		assertEquals(response.kind, expectedType);
	}
});
