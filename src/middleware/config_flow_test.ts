// src/middleware/config_flow_test.ts
// Test to verify the config storage/retrieval flow works correctly with Pubky URLs

import { assertEquals } from "jsr:@std/assert@1";
import { getChatConfig, initDb, setChatConfig } from "@core/config/store.ts";

Deno.test("config flow preserves original URL identifier", () => {
	initDb(":memory:");

	const chatId = "test-chat";
	const pubkyUrl =
		"pubky://c5jsbrwmouzedmf11qijk3gp8qeizkdsgtneq5t185jc41wxn6my/pub/pubky-json-editor/test1.json";
	const fetchedConfig = {
		configId: "test", // This is what's inside the JSON from Pubky
		services: [
			{
				name: "Hello",
				command: "hello",
				kind: "single_command" as const,
				entry: "./packages/demo_services/hello/service.ts",
			},
		],
		listeners: [],
	};

	// Simulate /setconfig flow: store using original URL, not the configId from fetched content
	setChatConfig(chatId, pubkyUrl, fetchedConfig);

	// Simulate /updateconfig flow: retrieve the stored config_id (should be the original URL)
	const stored = getChatConfig(chatId);
	assertEquals(stored?.config_id, pubkyUrl, "Should store original URL as config_id");

	// Parse the stored config to verify content is correct
	const parsedConfig = JSON.parse(stored?.config_json || "{}");
	assertEquals(parsedConfig.configId, "test", "Should preserve fetched configId in content");
	assertEquals(parsedConfig.services.length, 1, "Should have correct service count");
});

Deno.test("config flow works with local templates too", () => {
	initDb(":memory:");

	const chatId = "test-chat-2";
	const templateId = "default";
	const fetchedConfig = {
		configId: "default",
		services: [
			{
				name: "Hello",
				command: "hello",
				kind: "single_command" as const,
				entry: "./packages/demo_services/hello/service.ts",
			},
		],
		listeners: [],
	};

	// Simulate /setconfig with local template
	setChatConfig(chatId, templateId, fetchedConfig);

	// Verify storage
	const stored = getChatConfig(chatId);
	assertEquals(stored?.config_id, templateId, "Should store template ID as config_id");

	const parsedConfig = JSON.parse(stored?.config_json || "{}");
	assertEquals(parsedConfig.configId, "default", "Should preserve fetched configId in content");
});
