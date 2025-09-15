// src/core/snapshot/rebuild_after_gc_test.ts
import { deleteBundle, initDb } from "@core/config/store.ts";
import { buildSnapshot } from "@core/snapshot/snapshot.ts";
import { setChatConfig } from "@core/config/store.ts";
import { assert } from "jsr:@std/assert@1";

Deno.test("snapshot rebuilds missing bundle after manual deletion", async () => {
	initDb(":memory:");
	setChatConfig("chatRb", "default", { a: 1 });
	const snap1 = await buildSnapshot("chatRb", { force: true });
	const bundleHashes = new Set(Object.values(snap1.commands).map((r) => r.bundleHash));
	// Delete first bundle to simulate orphan removal
	const first = [...bundleHashes][0];
	deleteBundle(first);
	// Build again (force to bypass cache) and expect bundle restored
	const snap2 = await buildSnapshot("chatRb", { force: true });
	const bundleHashes2 = new Set(Object.values(snap2.commands).map((r) => r.bundleHash));
	assert(bundleHashes2.has(first), "expected missing bundle to be rebuilt");
});
