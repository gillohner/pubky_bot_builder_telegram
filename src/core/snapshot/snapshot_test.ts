// src/core/snapshot/snapshot_test.ts
import { buildSnapshot } from "@core/snapshot/snapshot.ts";

Deno.test("snapshot basic structure", async () => {
	const snap = await buildSnapshot("chat-test");
	if (!snap.commands.hello) throw new Error("Expected 'hello' command present");
	if (!snap.commands.env) throw new Error("Expected 'env' command present");
	if (snap.listeners.length < 1) {
		throw new Error("Expected at least one listener");
	}
	if (typeof snap.builtAt !== "number" || snap.builtAt <= 0) {
		throw new Error("builtAt invalid");
	}
});
