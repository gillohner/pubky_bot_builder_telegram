// src/core/config/store_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
	closeDb,
	deleteSnapshot,
	getChatConfig,
	initDb,
	loadSnapshot,
	saveSnapshot,
	setChatConfig,
} from "@core/config/store.ts";
import { RoutingSnapshot } from "@/types/routing.ts";

Deno.test("config store set and get", () => {
	initDb(":memory:");
	setChatConfig("chat1", "default", { foo: 1 });
	const rec = getChatConfig("chat1");
	assert(rec);
	assertEquals(rec?.config_id, "default");
	deleteSnapshot("chat1"); // no-op if none
	closeDb();
});

Deno.test("snapshot save and load", () => {
	initDb(":memory:");
	const snap: RoutingSnapshot = {
		commands: {},
		listeners: [],
		builtAt: Date.now(),
		version: 1,
	};
	saveSnapshot("chatX", snap);
	const rec = loadSnapshot("chatX");
	assert(rec);
	const parsed = JSON.parse(rec!.snapshot_json) as RoutingSnapshot;
	assertEquals(parsed.version, 1);
	closeDb();
});
