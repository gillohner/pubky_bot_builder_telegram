// src/core/snapshot/snapshot_test.ts
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { initDb, setChatConfig } from "@core/config/store.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";
initDb(":memory:");

Deno.test("snapshot basic structure", async () => {
	const snap = await buildSnapshot("chat-test");
	if (!snap.commands.hello) throw new Error("Expected 'hello' command present");
	if (!snap.commands.links) throw new Error("Expected 'links' command present");
	if (snap.listeners.length < 1) {
		throw new Error("Expected at least one listener");
	}
	if (typeof snap.builtAt !== "number" || snap.builtAt <= 0) {
		throw new Error("builtAt invalid");
	}
});

Deno.test("snapshot fake template variant", async () => {
	// Set chat config to fake template (reuse in-memory db)
	setChatConfig("chatFake", "fake", { configId: "fake" });
	const snap = await buildSnapshot("chatFake", { force: true });
	// Expect hello present with overridden config greeting
	const hello = snap.commands.hello;
	assert(hello, "hello command missing in fake template");
	assertEquals(hello.config?.message, "FAKE template override!");
	// Expect that newevent command from default is absent in fake
	assert(!snap.commands.newevent, "newevent command should not exist in fake template");
});

Deno.test("switching template updates command set", async () => {
	// Use a distinct chat id to avoid interference
	const chatId = "chatTemplateSwitch";
	// First build default snapshot (should expose /newevent command)
	const snapDefault = await buildSnapshot(chatId, { force: true });
	assert(snapDefault.commands.newevent, "expected /newevent in default template");
	assert(!snapDefault.commands["hello2"], "hello2 should not exist in default template");
	// Now switch to fake template
	setChatConfig(chatId, "fake", { configId: "fake" });
	// Build WITHOUT force to ensure cache invalidation logic handles config change
	const snapAfter = await buildSnapshot(chatId);
	assert(
		!snapAfter.commands.newevent,
		"old /newevent command should be gone after template switch",
	);
	assert(snapAfter.commands.hello, "expected /hello after switching to fake template");
});
