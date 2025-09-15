// src/middleware/admin.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { userIsAdmin } from "@middleware/admin.ts";

Deno.test("userIsAdmin returns true for private chat", async () => {
	const ok = await userIsAdmin({ chat: { id: 1, type: "private" }, from: { id: 1 } });
	assert(ok);
});

Deno.test("userIsAdmin returns false for group when not admin", async () => {
	const ok = await userIsAdmin({
		chat: { id: 1, type: "group" },
		from: { id: 2 },
		getChatAdministrators: () => Promise.resolve([]),
	});
	assertEquals(ok, false);
});

Deno.test("userIsAdmin returns true for group when in admin list", async () => {
	const ok = await userIsAdmin({
		chat: { id: 1, type: "supergroup" },
		from: { id: 42 },
		getChatAdministrators: () => Promise.resolve([{ user: { id: 42 } } as unknown as never]),
	});
	assert(ok);
});
