// src/core/ttl/store_test.ts
// Tests for TTL store tracking & cleanup logic.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { _closeKv, cleanupAll, cleanupExpired, trackMessage } from "./store.ts";

Deno.test("trackMessage stores record and cleanupAll deletes it", async () => {
	await trackMessage({
		platform: "telegram",
		chatId: 1,
		messageId: 111,
		ttlSeconds: 10,
		now: 1000,
	});
	const deleted: Array<number> = [];
	const removed = await cleanupAll((m) => {
		deleted.push(m.messageId);
	});
	assertEquals(removed, 1);
	assertEquals(deleted, [111]);
	await _closeKv();
});

Deno.test("cleanupExpired only removes expired", async () => {
	// add 2 messages, one expired at now=2000, one in future
	await trackMessage({ platform: "telegram", chatId: 1, messageId: 201, ttlSeconds: 1, now: 1000 }); // deleteAt=2000
	await trackMessage({ platform: "telegram", chatId: 1, messageId: 202, ttlSeconds: 5, now: 1000 }); // deleteAt=6000
	const deleted: number[] = [];
	const removedExpired = await cleanupExpired((m) => {
		deleted.push(m.messageId);
	}, 2500);
	assertEquals(removedExpired, 1);
	assertEquals(deleted, [201]);
	// run second pass full cleanup
	const removedAll = await cleanupAll(async () => {});
	assert(removedAll >= 1); // at least the remaining
	await _closeKv();
});
