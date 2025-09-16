// src/core/snapshot/snapshot_test.ts
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { initDb, setChatConfig } from "@core/config/store.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";
initDb(":memory:");

Deno.test("snapshot basic structure", async () => {
	const snap = await buildSnapshot("chat-test");
	if (!snap.commands.hello) throw new Error("Expected 'hello' command present");
	if (!snap.commands.secprobe) throw new Error("Expected 'secprobe' command present");
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
	assertEquals(hello.config?.greeting, "FAKE template override!");
	// Expect that flow/survey commands from default are absent
	assert(!snap.commands.flow, "flow command should not exist in fake template");
	assert(!snap.commands.survey, "survey command should not exist in fake template");
});
