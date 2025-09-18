// src/core/config/store_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
	closeDb,
	deleteSnapshotByConfigHash,
	getChatConfig,
	initDb,
	loadSnapshotByConfigHash,
	saveSnapshotByConfigHash,
	setChatConfig,
} from "@core/config/store.ts";
import type { RoutingSnapshot } from "@schema/routing.ts";

Deno.test("config store set and get", () => {
	initDb(":memory:");
	setChatConfig("chat1", "default", { foo: 1 }, "hash-abc");
	const rec = getChatConfig("chat1");
	assert(rec);
	assertEquals(rec?.config_id, "default");
	assertEquals(rec?.config_hash, "hash-abc");
	// deletion by config hash (no snapshot yet, should be no-op)
	deleteSnapshotByConfigHash("hash-abc");
	closeDb();
});

Deno.test("snapshot save/load/delete by config hash", () => {
	initDb(":memory:");
	const hash = "cfg-deadbeef";
	const snap: RoutingSnapshot = {
		commands: {},
		listeners: [],
		builtAt: Date.now(),
		version: 1,
	};
	saveSnapshotByConfigHash(hash, snap);
	const rec = loadSnapshotByConfigHash(hash);
	assert(rec);
	const parsed = JSON.parse(rec!.snapshot_json) as RoutingSnapshot;
	assertEquals(parsed.version, 1);
	// Delete and ensure gone
	deleteSnapshotByConfigHash(hash);
	const missing = loadSnapshotByConfigHash(hash);
	assertEquals(missing, undefined);
	closeDb();
});

Deno.test("deleteSnapshotByConfigHash no-op on unknown hash", () => {
	initDb(":memory:");
	deleteSnapshotByConfigHash("nonexistent-hash");
	// nothing to assert besides no throw
	closeDb();
});
