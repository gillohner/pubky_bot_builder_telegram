// src/core/snapshot/invalidation_gc_test.ts
import { initDb, listAllBundleHashes, saveServiceBundle } from "@core/config/store.ts";
import { buildSnapshot, gcOrphanBundles } from "@core/snapshot/snapshot.ts";
import { setChatConfig, sha256Hex } from "@core/config/store.ts";
import { assert } from "jsr:@std/assert@1";

Deno.test("gc removes orphan bundles", async () => {
	initDb(":memory:");
	setChatConfig("chatGc", "default", { cfg: 1 });
	await buildSnapshot("chatGc", { force: true });
	// Add a fake orphan bundle
	const fakeCode = "// orphan bundle";
	const fakeHash = await sha256Hex(fakeCode);
	saveServiceBundle({
		bundle_hash: fakeHash,
		service_id: "orphan",
		version: "1.0.0",
		data_url: "data:text/plain;base64,",
		updated_at: Date.now(),
	});
	const before = new Set(listAllBundleHashes());
	assert(before.has(fakeHash), "fake hash should exist before gc");
	const { deleted, kept } = gcOrphanBundles();
	assert(deleted.includes(fakeHash), "orphan hash should be deleted");
	assert(!kept.includes(fakeHash), "kept should not include orphan");
});
